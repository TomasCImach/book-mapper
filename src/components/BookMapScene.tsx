import { Canvas, useFrame, useLoader, useThree } from '@react-three/fiber'
import { Html, OrbitControls, Stars } from '@react-three/drei'
import {
  Suspense,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type RefObject,
  type SetStateAction,
} from 'react'
import * as THREE from 'three'
import { TextureLoader } from 'three'
import {
  getBookModel,
  getVisibleSegments,
  type BookModel,
  type RouteSegment,
  type Waypoint,
} from '../data/journey'
import {
  EARTH_RENDER_RADIUS,
  getSegmentDistanceKm,
  getSegmentRenderPoints,
  positionToVector3,
} from '../lib/geo'
import { trackEvent } from '../lib/analytics'
import { useMapStore } from '../store/mapStore'

const DEPTH_SCALE_TRUE = 1
const DEPTH_SCALE_EXAGGERATED = 24
const MIN_CAMERA_DISTANCE = 7
const MAX_CAMERA_DISTANCE = 17
const SURFACE_PIVOT_MIN_DISTANCE = 0.65
const SURFACE_PIVOT_MAX_DISTANCE = 24
const FOCUS_TARGET_MIN_RADIUS = 0.72
const FOCUS_TARGET_MAX_RADIUS = EARTH_RENDER_RADIUS + 1.8
const FOCUS_TARGET_KEY_STEP = 0.28
const FOCUS_TARGET_WHEEL_SCALE = 0.0028
const FOCUS_TARGET_DRAG_SCALE = 0.008
const ROUTE_SCALE_CLOSE = 0.22
const ROUTE_SCALE_FAR = 1.1
const TAG_SCALE_CLOSE = 0.86
const TAG_SCALE_FAR = 1.06
const INITIAL_CAMERA_DISTANCE = new THREE.Vector3(9, 5.4, 9).length()

type ZoomFeatureScale = {
  route: number
  tag: number
}

type OrbitControlsLike = THREE.EventDispatcher & {
  minDistance: number
  maxDistance: number
  target: THREE.Vector3
  update: () => void
}

function getRouteZoomScale(distance: number) {
  const t = THREE.MathUtils.clamp(
    (distance - MIN_CAMERA_DISTANCE) / (MAX_CAMERA_DISTANCE - MIN_CAMERA_DISTANCE),
    0,
    1,
  )

  return THREE.MathUtils.lerp(ROUTE_SCALE_CLOSE, ROUTE_SCALE_FAR, t)
}

function getTagZoomScale(distance: number) {
  const t = THREE.MathUtils.clamp(
    (distance - MIN_CAMERA_DISTANCE) / (MAX_CAMERA_DISTANCE - MIN_CAMERA_DISTANCE),
    0,
    1,
  )

  return THREE.MathUtils.lerp(TAG_SCALE_CLOSE, TAG_SCALE_FAR, t)
}

function getZoomFeatureScale(distance: number): ZoomFeatureScale {
  return {
    route: getRouteZoomScale(distance),
    tag: getTagZoomScale(distance),
  }
}

function getDepthScale(depthExaggerated: boolean) {
  return depthExaggerated ? DEPTH_SCALE_EXAGGERATED : DEPTH_SCALE_TRUE
}

export function BookMapScene() {
  const selectedBookId = useMapStore((state) => state.selectedBookId)
  const selectedChapter = useMapStore((state) => state.selectedChapter)
  const selectedSegmentId = useMapStore((state) => state.selectedSegmentId)
  const depthExaggerated = useMapStore((state) => state.depthExaggerated)
  const bookModel = useMemo(() => getBookModel(selectedBookId), [selectedBookId])
  const globeRef = useRef<THREE.Group>(null)
  const [featureScale, setFeatureScale] = useState(() =>
    getZoomFeatureScale(INITIAL_CAMERA_DISTANCE),
  )

  return (
    <section className="map-stage" aria-label="Interactive 3D book map">
      <Canvas
        camera={{ position: [9, 5.4, 9], fov: 46, near: 0.1, far: 100 }}
        dpr={[1, 2]}
        gl={{ antialias: true }}
      >
        <color attach="background" args={['#10100f']} />
        <fog attach="fog" args={['#10100f', 14, 26]} />
        <Suspense fallback={null}>
          <ambientLight intensity={1.15} />
        <directionalLight position={[6, 7, 5]} intensity={2.6} />
        <pointLight position={[-5, -3, -2]} color="#ef6b4a" intensity={1.4} />
        <Stars radius={45} depth={20} count={1600} factor={2.4} fade speed={0.15} />
        <group ref={globeRef} rotation={[0.04, -0.24, 0.01]}>
          <Earth />
          <CutawayDisk />
          <RouteLayer
            bookModel={bookModel}
            selectedChapter={selectedChapter}
            selectedSegmentId={selectedSegmentId}
            depthScale={getDepthScale(depthExaggerated)}
            featureScale={featureScale}
          />
        </group>
        <SurfaceDragControls targetRef={globeRef} />
        <FeatureScaleController setFeatureScale={setFeatureScale} />
        <OrbitControls
          makeDefault
          enableRotate={false}
          enablePan={false}
          minDistance={MIN_CAMERA_DISTANCE}
          maxDistance={MAX_CAMERA_DISTANCE}
          zoomSpeed={0.75}
        />
        </Suspense>
      </Canvas>
    </section>
  )
}

function SurfaceDragControls({
  targetRef,
}: {
  targetRef: RefObject<THREE.Group | null>
}) {
  const { camera, gl, controls } = useThree()

  useEffect(() => {
    const canvas = gl.domElement
    const orbitControls = controls as OrbitControlsLike | null
    const raycaster = new THREE.Raycaster()
    const pointer = new THREE.Vector2()
    const surface = new THREE.Sphere(new THREE.Vector3(), EARTH_RENDER_RADIUS)
    const startDirection = new THREE.Vector3()
    const currentDirection = new THREE.Vector3()
    const initialQuaternion = new THREE.Quaternion()
    const deltaQuaternion = new THREE.Quaternion()
    const closestPoint = new THREE.Vector3()
    const shiftDragStart = new THREE.Vector2()
    const spinStart = new THREE.Vector2()
    const orbitPivot = new THREE.Vector3()
    const orbitStartOffset = new THREE.Vector3()
    const orbitNextOffset = new THREE.Vector3()
    const orbitStartUpAxis = new THREE.Vector3()
    const orbitStartRightAxis = new THREE.Vector3()
    const orbitForward = new THREE.Vector3()
    const zoomOffset = new THREE.Vector3()
    const orbitYaw = new THREE.Quaternion()
    const orbitPitch = new THREE.Quaternion()
    const orbitCombined = new THREE.Quaternion()
    const spinStartQuaternion = new THREE.Quaternion()
    const spinUpAxis = new THREE.Vector3()
    const spinRightAxis = new THREE.Vector3()
    const focusDragStart = new THREE.Vector2()
    const focusDirection = new THREE.Vector3()
    const nextFocusTarget = new THREE.Vector3()
    const origin = new THREE.Vector3()
    let activePointerId: number | null = null
    let dragMode: 'none' | 'focus' | 'orbit' | 'spin' | 'surface' = 'none'
    let focusRadius = EARTH_RENDER_RADIUS
    let focusStartRadius = EARTH_RENDER_RADIUS

    function setSurfacePivotZoomLimits() {
      if (!orbitControls) {
        return
      }

      orbitControls.minDistance = SURFACE_PIVOT_MIN_DISTANCE
      orbitControls.maxDistance = SURFACE_PIVOT_MAX_DISTANCE
    }

    function zoomFromActivePivot(delta: number) {
      const target = orbitControls?.target ?? origin
      const minDistance = orbitControls?.minDistance ?? MIN_CAMERA_DISTANCE
      const maxDistance = orbitControls?.maxDistance ?? MAX_CAMERA_DISTANCE

      zoomOffset.copy(camera.position).sub(target)
      const nextDistance = THREE.MathUtils.clamp(
        zoomOffset.length() + delta,
        minDistance,
        maxDistance,
      )

      if (zoomOffset.lengthSq() < 0.0001) {
        return
      }

      zoomOffset.normalize().multiplyScalar(nextDistance)
      camera.position.copy(target).add(zoomOffset)
      camera.lookAt(target)
      orbitControls?.update()
    }

    function readFocusDirection(
      event: PointerEvent | WheelEvent | null,
      target: THREE.Vector3,
    ) {
      const activeTarget = orbitControls?.target

      if (activeTarget && activeTarget.lengthSq() > 0.0001) {
        target.copy(activeTarget).normalize()
        return true
      }

      if (event instanceof PointerEvent && readSurfaceDirection(event, target)) {
        return true
      }

      if (camera.position.lengthSq() < 0.0001) {
        return false
      }

      target.copy(camera.position).normalize()
      return true
    }

    function getCurrentFocusRadius() {
      const activeTarget = orbitControls?.target

      if (activeTarget && activeTarget.lengthSq() > 0.0001) {
        return activeTarget.length()
      }

      return focusRadius
    }

    function clampFocusRadius(radius: number, direction: THREE.Vector3) {
      const cameraRadialDistance = camera.position.dot(direction)
      const cameraLimitedMax = Math.max(
        EARTH_RENDER_RADIUS,
        cameraRadialDistance - SURFACE_PIVOT_MIN_DISTANCE,
      )

      return THREE.MathUtils.clamp(
        radius,
        FOCUS_TARGET_MIN_RADIUS,
        Math.min(FOCUS_TARGET_MAX_RADIUS, cameraLimitedMax),
      )
    }

    function setFocusTarget(radius: number, direction: THREE.Vector3) {
      const nextRadius = clampFocusRadius(radius, direction)
      focusRadius = nextRadius
      nextFocusTarget.copy(direction).normalize().multiplyScalar(nextRadius)
      setSurfacePivotZoomLimits()

      if (orbitControls) {
        orbitControls.target.copy(nextFocusTarget)
        orbitControls.update()
      } else {
        camera.lookAt(nextFocusTarget)
      }
    }

    function moveFocusTarget(deltaRadius: number, event: PointerEvent | WheelEvent | null) {
      if (!readFocusDirection(event, focusDirection)) {
        return
      }

      setFocusTarget(getCurrentFocusRadius() + deltaRadius, focusDirection)
    }

    function readSurfaceDirection(event: PointerEvent, target: THREE.Vector3) {
      const rect = canvas.getBoundingClientRect()
      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
      pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1
      raycaster.setFromCamera(pointer, camera)

      if (raycaster.ray.intersectSphere(surface, target)) {
        target.normalize()
        return true
      }

      const distanceToClosest = Math.max(
        0,
        -raycaster.ray.origin.dot(raycaster.ray.direction),
      )
      closestPoint
        .copy(raycaster.ray.direction)
        .multiplyScalar(distanceToClosest)
        .add(raycaster.ray.origin)

      if (closestPoint.lengthSq() < 0.0001) {
        return false
      }

      target.copy(closestPoint).normalize()
      return true
    }

    function finishDrag() {
      if (activePointerId !== null && canvas.hasPointerCapture(activePointerId)) {
        canvas.releasePointerCapture(activePointerId)
      }

      activePointerId = null
      dragMode = 'none'
      canvas.classList.remove('surface-dragging')
      canvas.classList.remove('surface-depth')
      canvas.classList.remove('surface-tilt')
      canvas.classList.remove('surface-spin')
    }

    function handlePointerDown(event: PointerEvent) {
      if (!targetRef.current) {
        return
      }

      const isShiftOrbit = event.shiftKey || event.button === 1
      const isSpin = event.button === 2 || (event.button === 0 && event.altKey)
      const isFocusDrag =
        event.button === 0 &&
        !event.shiftKey &&
        !event.altKey &&
        (event.ctrlKey || event.metaKey)

      if (!isShiftOrbit && !isSpin && !isFocusDrag && event.button !== 0) {
        return
      }

      if (isShiftOrbit) {
        if (!readSurfaceDirection(event, startDirection)) {
          return
        }

        activePointerId = event.pointerId
        dragMode = 'orbit'
        shiftDragStart.set(event.clientX, event.clientY)
        orbitPivot.copy(startDirection).multiplyScalar(focusRadius)
        orbitStartOffset.copy(camera.position).sub(orbitPivot)
        orbitStartUpAxis.copy(camera.up).normalize()
        orbitForward.copy(orbitPivot).sub(camera.position).normalize()
        orbitStartRightAxis.copy(orbitForward).cross(orbitStartUpAxis).normalize()

        if (orbitStartRightAxis.lengthSq() < 0.0001) {
          orbitStartRightAxis.set(1, 0, 0)
        }

        setSurfacePivotZoomLimits()
        orbitControls?.target.copy(orbitPivot)
        orbitControls?.update()
        canvas.setPointerCapture(event.pointerId)
        canvas.classList.add('surface-tilt')
        event.preventDefault()
        return
      }

      if (isFocusDrag) {
        if (!readFocusDirection(event, focusDirection)) {
          return
        }

        activePointerId = event.pointerId
        dragMode = 'focus'
        focusDragStart.set(event.clientX, event.clientY)
        focusStartRadius = getCurrentFocusRadius()
        canvas.setPointerCapture(event.pointerId)
        canvas.classList.add('surface-depth')
        event.preventDefault()
        return
      }

      if (isSpin) {
        activePointerId = event.pointerId
        dragMode = 'spin'
        spinStart.set(event.clientX, event.clientY)
        spinStartQuaternion.copy(targetRef.current.quaternion)
        spinUpAxis.copy(camera.up).normalize()

        const forward = new THREE.Vector3().subVectors(origin, camera.position).normalize()
        spinRightAxis
          .copy(forward)
          .cross(spinUpAxis)
          .normalize()

        if (spinRightAxis.lengthSq() < 0.0001) {
          spinRightAxis.set(1, 0, 0)
        }

        canvas.setPointerCapture(event.pointerId)
        canvas.classList.add('surface-spin')
        event.preventDefault()
        return
      }

      if (!readSurfaceDirection(event, startDirection)) {
        return
      }

      activePointerId = event.pointerId
      dragMode = 'surface'
      initialQuaternion.copy(targetRef.current.quaternion)
      canvas.setPointerCapture(event.pointerId)
      canvas.classList.add('surface-dragging')
      event.preventDefault()
    }

    function handlePointerMove(event: PointerEvent) {
      if (activePointerId !== event.pointerId || !targetRef.current) {
        return
      }

      if (dragMode === 'orbit') {
        const deltaX = (event.clientX - shiftDragStart.x) * 0.0055
        const deltaY = (event.clientY - shiftDragStart.y) * 0.0055

        orbitYaw.setFromAxisAngle(orbitStartUpAxis, -deltaX)
        orbitPitch.setFromAxisAngle(orbitStartRightAxis, deltaY)
        orbitCombined.copy(orbitYaw).multiply(orbitPitch)
        orbitNextOffset.copy(orbitStartOffset).applyQuaternion(orbitCombined)
        camera.position.copy(orbitPivot).add(orbitNextOffset)
        camera.lookAt(orbitPivot)
        orbitControls?.target.copy(orbitPivot)
        orbitControls?.update()
        event.preventDefault()
        return
      }

      if (dragMode === 'focus') {
        setFocusTarget(
          focusStartRadius - (event.clientY - focusDragStart.y) * FOCUS_TARGET_DRAG_SCALE,
          focusDirection,
        )
        event.preventDefault()
        return
      }

      if (dragMode === 'spin') {
        const deltaX = (event.clientX - spinStart.x) * 0.007
        const deltaY = (event.clientY - spinStart.y) * 0.007
        const yaw = new THREE.Quaternion().setFromAxisAngle(spinUpAxis, -deltaX)
        const pitch = new THREE.Quaternion().setFromAxisAngle(
          spinRightAxis,
          deltaY,
        )
        targetRef.current.quaternion.copy(
          yaw.multiply(pitch).multiply(spinStartQuaternion),
        )
        event.preventDefault()
        return
      }

      if (dragMode === 'none') {
        return
      }

      if (!readSurfaceDirection(event, currentDirection)) {
        return
      }

      deltaQuaternion.setFromUnitVectors(startDirection, currentDirection)
      targetRef.current.quaternion.copy(deltaQuaternion.multiply(initialQuaternion))
      event.preventDefault()
    }

    function handlePointerUp(event: PointerEvent) {
      if (activePointerId === event.pointerId) {
        finishDrag()
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      const activeTag = (document.activeElement?.tagName || '').toUpperCase()
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(activeTag)) {
        return
      }

      if (!targetRef.current) {
        return
      }

      const rotateStep = event.shiftKey ? 0.14 : 0.08
      const zoomStep = event.shiftKey ? 0.5 : 0.25
      const focusStep = event.shiftKey ? FOCUS_TARGET_KEY_STEP * 2 : FOCUS_TARGET_KEY_STEP

      if (event.key === 'ArrowLeft' || event.key.toLowerCase() === 'a') {
        targetRef.current.rotateY(rotateStep)
        event.preventDefault()
        return
      }

      if (event.key === 'ArrowRight' || event.key.toLowerCase() === 'd') {
        targetRef.current.rotateY(-rotateStep)
        event.preventDefault()
        return
      }

      if (event.key === 'ArrowUp' || event.key.toLowerCase() === 'w') {
        targetRef.current.rotateX(rotateStep)
        event.preventDefault()
        return
      }

      if (event.key === 'ArrowDown' || event.key.toLowerCase() === 's') {
        targetRef.current.rotateX(-rotateStep)
        event.preventDefault()
        return
      }

      if (event.key === '+' || event.key === '=') {
        zoomFromActivePivot(-zoomStep)
        event.preventDefault()
        return
      }

      if (event.key === '-' || event.key === '_') {
        zoomFromActivePivot(zoomStep)
        event.preventDefault()
        return
      }

      if (event.key === '[' || event.code === 'BracketLeft' || event.key === 'PageDown') {
        moveFocusTarget(-focusStep, null)
        event.preventDefault()
        return
      }

      if (event.key === ']' || event.code === 'BracketRight' || event.key === 'PageUp') {
        moveFocusTarget(focusStep, null)
        event.preventDefault()
      }
    }

    function handleWheel(event: WheelEvent) {
      if (!event.altKey && !event.shiftKey) {
        return
      }

      moveFocusTarget(event.deltaY * FOCUS_TARGET_WHEEL_SCALE, event)
      event.preventDefault()
      event.stopImmediatePropagation()
    }

    function handleContextMenu(event: Event) {
      event.preventDefault()
    }

    canvas.addEventListener('pointerdown', handlePointerDown)
    canvas.addEventListener('pointermove', handlePointerMove)
    canvas.addEventListener('pointerup', handlePointerUp)
    canvas.addEventListener('pointercancel', handlePointerUp)
    canvas.addEventListener('lostpointercapture', finishDrag)
    window.addEventListener('keydown', handleKeyDown)
    canvas.addEventListener('wheel', handleWheel, { capture: true, passive: false })
    canvas.addEventListener('contextmenu', handleContextMenu)

    return () => {
      finishDrag()
      canvas.removeEventListener('pointerdown', handlePointerDown)
      canvas.removeEventListener('pointermove', handlePointerMove)
      canvas.removeEventListener('pointerup', handlePointerUp)
      canvas.removeEventListener('pointercancel', handlePointerUp)
      canvas.removeEventListener('lostpointercapture', finishDrag)
      window.removeEventListener('keydown', handleKeyDown)
      canvas.removeEventListener('wheel', handleWheel, { capture: true })
      canvas.removeEventListener('contextmenu', handleContextMenu)
    }
    }, [camera, controls, gl, targetRef])

  return null
}

function FeatureScaleController({
  setFeatureScale,
}: {
  setFeatureScale: Dispatch<SetStateAction<ZoomFeatureScale>>
}) {
  const { camera } = useThree()
  const lastRouteScale = useRef(0)
  const lastTagScale = useRef(0)

  useFrame(() => {
    const distance = Math.max(MIN_CAMERA_DISTANCE, camera.position.length())
    const nextScale = getZoomFeatureScale(distance)

    if (
      Math.abs(nextScale.route - lastRouteScale.current) < 0.005 &&
      Math.abs(nextScale.tag - lastTagScale.current) < 0.005
    ) {
      return
    }

    lastRouteScale.current = nextScale.route
    lastTagScale.current = nextScale.tag
    setFeatureScale(nextScale)
  })

  return null
}

function Earth() {
  const [earthMap, specularMap] = useLoader(TextureLoader, [
    '/textures/earth_atmos_2048.jpg',
    '/textures/earth_specular_2048.jpg',
  ])

  return (
    <group>
      <mesh>
        <sphereGeometry args={[EARTH_RENDER_RADIUS, 96, 64]} />
        <meshPhongMaterial
          map={earthMap}
          specularMap={specularMap}
          specular="#46606e"
          shininess={10}
          transparent
          opacity={0.56}
          depthWrite={false}
        />
      </mesh>
      <mesh scale={1.006}>
        <sphereGeometry args={[EARTH_RENDER_RADIUS, 64, 32]} />
        <meshBasicMaterial color="#dce7df" transparent opacity={0.08} wireframe />
      </mesh>
    </group>
  )
}

function CutawayDisk() {
  const rings = [
    { radius: 5.98, color: '#2a685f', opacity: 0.1 },
    { radius: 5.1, color: '#d6ad5a', opacity: 0.1 },
    { radius: 3.6, color: '#b84a2f', opacity: 0.12 },
    { radius: 1.7, color: '#f15b3b', opacity: 0.18 },
  ]

  return (
    <group rotation={[0, -0.48, 0]}>
      {rings.map((ring, index) => (
        <mesh key={ring.radius} position={[0, 0, -0.02 * index]}>
          <circleGeometry args={[ring.radius, 96]} />
          <meshBasicMaterial
            color={ring.color}
            transparent
            opacity={ring.opacity}
            side={THREE.DoubleSide}
            depthWrite={false}
          />
        </mesh>
      ))}
      <mesh>
        <ringGeometry args={[EARTH_RENDER_RADIUS - 0.03, EARTH_RENDER_RADIUS + 0.02, 120]} />
        <meshBasicMaterial color="#f2dfaa" transparent opacity={0.36} side={THREE.DoubleSide} />
      </mesh>
    </group>
  )
}

function RouteLayer({
  bookModel,
  selectedChapter,
  selectedSegmentId,
  depthScale,
  featureScale,
}: {
  bookModel: BookModel
  selectedChapter: number
  selectedSegmentId: string
  depthScale: number
  featureScale: ZoomFeatureScale
}) {
  const setSelectedSegmentId = useMapStore((state) => state.setSelectedSegmentId)
  const visibleSegments = useMemo(
    () => getVisibleSegments(selectedChapter, bookModel.routeSegments),
    [bookModel.routeSegments, selectedChapter],
  )
  const visibleWaypointIds = useMemo(() => {
    const ids = new Set<string>()

    for (const segment of visibleSegments) {
      ids.add(segment.from)
      ids.add(segment.to)
    }

    return ids
  }, [visibleSegments])

  const selectedSegment =
    visibleSegments.find((segment) => segment.id === selectedSegmentId) ??
    visibleSegments[visibleSegments.length - 1]

  function handleSegmentSelect(segment: RouteSegment) {
    setSelectedSegmentId(segment.id)
    trackEvent('route_segment_selected', {
      book_id: bookModel.book.id,
      book_title: bookModel.book.title,
      segment_id: segment.id,
      segment_title: segment.title,
      chapter_start: segment.chapterStart,
      chapter_end: segment.chapterEnd,
      medium: segment.medium,
      medium_label: bookModel.mediumLabels[segment.medium],
      distance_km:
        Math.round(getSegmentDistanceKm(segment, bookModel.waypointById) * 100) / 100,
      method: 'map_tube',
    })
  }

  return (
    <group>
      {visibleSegments.map((segment) => (
        <RouteTube
          key={segment.id}
          segment={segment}
          active={segment.id === selectedSegment?.id}
          depthScale={depthScale}
          featureScale={featureScale.route}
          mediumColors={bookModel.mediumColors}
          onSelect={() => handleSegmentSelect(segment)}
          waypointById={bookModel.waypointById}
        />
      ))}
      {bookModel.waypoints
        .filter((waypoint) => visibleWaypointIds.has(waypoint.id))
        .map((waypoint) => (
          <WaypointMarker
            key={waypoint.id}
            waypoint={waypoint}
            active={
              selectedSegment?.from === waypoint.id ||
              selectedSegment?.to === waypoint.id ||
              waypoint.id === 'scartaris-crater' ||
              waypoint.id === 'stromboli'
            }
            label={
              selectedSegment?.from === waypoint.id ||
              selectedSegment?.to === waypoint.id ||
              waypoint.id === 'scartaris-crater' ||
              waypoint.id === 'stromboli'
            }
            depthScale={depthScale}
            featureScale={featureScale}
          />
        ))}
    </group>
  )
}

function RouteTube({
  segment,
  active,
  depthScale,
  featureScale,
  mediumColors,
  onSelect,
  waypointById,
}: {
  segment: RouteSegment
  active: boolean
  depthScale: number
  featureScale: number
  mediumColors: BookModel['mediumColors']
  onSelect: () => void
  waypointById: BookModel['waypointById']
}) {
  const geometry = useMemo(() => {
    const points = getSegmentRenderPoints(segment, depthScale, waypointById)
    const curve = new THREE.CatmullRomCurve3(points, false, 'centripetal', 0.45)
    const radius = (active ? 0.045 : 0.026) * featureScale
    return new THREE.TubeGeometry(curve, Math.max(points.length * 4, 24), radius, 8)
  }, [active, depthScale, featureScale, segment, waypointById])

  return (
    <mesh geometry={geometry} onClick={onSelect}>
      <meshStandardMaterial
        color={mediumColors[segment.medium]}
        emissive={mediumColors[segment.medium]}
        emissiveIntensity={active ? 0.75 : 0.24}
        roughness={0.38}
        metalness={0.2}
        transparent
        opacity={active ? 1 : 0.72}
      />
    </mesh>
  )
}

function WaypointMarker({
  waypoint,
  active,
  label,
  depthScale,
  featureScale,
}: {
  waypoint: Waypoint
  active: boolean
  label: boolean
  depthScale: number
  featureScale: ZoomFeatureScale
}) {
  const position = useMemo(
    () => positionToVector3(waypoint.position, depthScale),
    [depthScale, waypoint.position],
  )
  const color = active ? '#ffcf5a' : '#efe6d0'
  const markerRadius = (active ? 0.085 : 0.052) * featureScale.route

  return (
    <group position={position}>
      <mesh>
        <sphereGeometry args={[markerRadius, 16, 16]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={active ? 0.85 : 0.28}
          roughness={0.25}
        />
      </mesh>
      {label && (
        <Html center>
          <div
            style={{
              transform: `scale(${featureScale.tag})`,
              transformOrigin: 'center',
            }}
          >
            <span className="scene-label">{waypoint.name}</span>
          </div>
        </Html>
      )}
    </group>
  )
}
