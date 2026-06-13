import { Canvas, useFrame, useLoader, useThree } from '@react-three/fiber'
import { Html, OrbitControls, Stars } from '@react-three/drei'
import {
  ArrowDown,
  ArrowUp,
  Compass,
  RotateCcw,
  RotateCw,
  ZoomIn,
  ZoomOut,
} from 'lucide-react'
import {
  Suspense,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type RefObject,
  type ReactNode,
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
const INITIAL_CAMERA_POSITION = new THREE.Vector3(9, 5.4, 9)
const MAP_CAMERA_COMMAND_EVENT = 'book-map-camera-command'

type MapCameraCommand =
  | 'zoom-in'
  | 'zoom-out'
  | 'tilt-up'
  | 'tilt-down'
  | 'rotate-left'
  | 'rotate-right'
  | 'reset'

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
    <section className="map-stage" aria-label="Interactive 3D title map">
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
      <MapCameraControls />
    </section>
  )
}

function MapCameraControls() {
  function dispatchCameraCommand(command: MapCameraCommand) {
    window.dispatchEvent(
      new CustomEvent<MapCameraCommand>(MAP_CAMERA_COMMAND_EVENT, {
        detail: command,
      }),
    )
  }

  return (
    <div className="map-camera-controls" aria-label="Map camera controls">
      <div className="map-control-stack">
        <MapControlButton
          label="Zoom in"
          onClick={() => dispatchCameraCommand('zoom-in')}
        >
          <ZoomIn size={21} strokeWidth={2.1} />
        </MapControlButton>
        <MapControlButton
          label="Zoom out"
          onClick={() => dispatchCameraCommand('zoom-out')}
        >
          <ZoomOut size={21} strokeWidth={2.1} />
        </MapControlButton>
      </div>
      <div className="map-control-stack map-orbit-controls">
        <MapControlButton
          label="Rotate left"
          onClick={() => dispatchCameraCommand('rotate-left')}
        >
          <RotateCcw size={20} strokeWidth={2.1} />
        </MapControlButton>
        <MapControlButton
          label="Reset compass"
          prominent
          onClick={() => dispatchCameraCommand('reset')}
        >
          <Compass size={21} strokeWidth={2.1} />
        </MapControlButton>
        <MapControlButton
          label="Rotate right"
          onClick={() => dispatchCameraCommand('rotate-right')}
        >
          <RotateCw size={20} strokeWidth={2.1} />
        </MapControlButton>
        <MapControlButton
          label="Tilt up"
          onClick={() => dispatchCameraCommand('tilt-up')}
        >
          <ArrowUp size={20} strokeWidth={2.1} />
        </MapControlButton>
        <MapControlButton
          label="Tilt down"
          onClick={() => dispatchCameraCommand('tilt-down')}
        >
          <ArrowDown size={20} strokeWidth={2.1} />
        </MapControlButton>
      </div>
    </div>
  )
}

function MapControlButton({
  label,
  children,
  prominent = false,
  onClick,
}: {
  label: string
  children: ReactNode
  prominent?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      className={prominent ? 'map-control-button prominent' : 'map-control-button'}
      aria-label={label}
      title={label}
      onClick={onClick}
    >
      {children}
    </button>
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
    const activePointers = new Map<
      number,
      {
        clientX: number
        clientY: number
        startX: number
        startY: number
        startedAt: number
      }
    >()
    const raycaster = new THREE.Raycaster()
    const pointer = new THREE.Vector2()
    const surface = new THREE.Sphere(new THREE.Vector3(), EARTH_RENDER_RADIUS)
    const startDirection = new THREE.Vector3()
    const currentDirection = new THREE.Vector3()
    const initialQuaternion = new THREE.Quaternion()
    const homeQuaternion = new THREE.Quaternion()
    const deltaQuaternion = new THREE.Quaternion()
    const closestPoint = new THREE.Vector3()
    const pointerStart = new THREE.Vector2()
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
    const touchStartCenter = new THREE.Vector2()
    const touchCurrentCenter = new THREE.Vector2()
    const touchTwistAxis = new THREE.Vector3()
    const touchTwist = new THREE.Quaternion()
    const origin = new THREE.Vector3()
    let activePointerId: number | null = null
    let dragMode: 'none' | 'focus' | 'orbit' | 'spin' | 'surface' | 'tapZoom' | 'touch' = 'none'
    let focusRadius = EARTH_RENDER_RADIUS
    let focusStartRadius = EARTH_RENDER_RADIUS
    let tapZoomStartDistance = INITIAL_CAMERA_DISTANCE
    let tapZoomStartY = 0
    let tapZoomMoved = false
    let lastTapTime = 0
    let lastTapX = 0
    let lastTapY = 0
    let touchStartDistance = 1
    let touchStartAngle = 0
    let touchStartCameraDistance = INITIAL_CAMERA_DISTANCE
    let touchGestureStartedAt = 0
    let touchGestureMoved = false

    if (targetRef.current) {
      homeQuaternion.copy(targetRef.current.quaternion)
    }

    function claimEvent(event: PointerEvent | MouseEvent) {
      event.preventDefault()
      event.stopImmediatePropagation()
    }

    function setSurfacePivotZoomLimits() {
      if (!orbitControls) {
        return
      }

      orbitControls.minDistance = SURFACE_PIVOT_MIN_DISTANCE
      orbitControls.maxDistance = SURFACE_PIVOT_MAX_DISTANCE
    }

    function setDefaultZoomLimits() {
      if (!orbitControls) {
        return
      }

      orbitControls.minDistance = MIN_CAMERA_DISTANCE
      orbitControls.maxDistance = MAX_CAMERA_DISTANCE
    }

    function setDistanceFromActivePivot(distance: number) {
      const target = orbitControls?.target ?? origin
      const minDistance = orbitControls?.minDistance ?? MIN_CAMERA_DISTANCE
      const maxDistance = orbitControls?.maxDistance ?? MAX_CAMERA_DISTANCE

      zoomOffset.copy(camera.position).sub(target)
      const nextDistance = THREE.MathUtils.clamp(
        distance,
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

    function zoomFromActivePivot(delta: number) {
      const target = orbitControls?.target ?? origin

      zoomOffset.copy(camera.position).sub(target)
      setDistanceFromActivePivot(zoomOffset.length() + delta)
    }

    function prepareOrbitFromPivot(pivot: THREE.Vector3) {
      orbitPivot.copy(pivot)
      orbitStartOffset.copy(camera.position).sub(orbitPivot)
      orbitStartUpAxis.copy(camera.up).normalize()
      orbitForward.copy(orbitPivot).sub(camera.position).normalize()
      orbitStartRightAxis.copy(orbitForward).cross(orbitStartUpAxis).normalize()

      if (orbitStartRightAxis.lengthSq() < 0.0001) {
        orbitStartRightAxis.set(1, 0, 0)
      }
    }

    function applyOrbitFromStart(
      deltaX: number,
      deltaY: number,
      nextDistance = orbitStartOffset.length(),
    ) {
      orbitYaw.setFromAxisAngle(orbitStartUpAxis, -deltaX)
      orbitPitch.setFromAxisAngle(orbitStartRightAxis, deltaY)
      orbitCombined.copy(orbitYaw).multiply(orbitPitch)
      orbitNextOffset.copy(orbitStartOffset).applyQuaternion(orbitCombined)

      if (orbitNextOffset.lengthSq() > 0.0001) {
        orbitNextOffset.setLength(nextDistance)
      }

      camera.position.copy(orbitPivot).add(orbitNextOffset)
      camera.lookAt(orbitPivot)
      orbitControls?.target.copy(orbitPivot)
      orbitControls?.update()
    }

    function orbitCameraBy(deltaX: number, deltaY: number) {
      prepareOrbitFromPivot(orbitControls?.target ?? origin)
      applyOrbitFromStart(deltaX, deltaY)
    }

    function resetMapCamera() {
      if (targetRef.current) {
        targetRef.current.quaternion.copy(homeQuaternion)
      }

      focusRadius = EARTH_RENDER_RADIUS
      camera.position.copy(INITIAL_CAMERA_POSITION)
      camera.up.set(0, 1, 0)
      camera.lookAt(origin)
      setDefaultZoomLimits()

      if (orbitControls) {
        orbitControls.target.copy(origin)
        orbitControls.update()
      }
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

    function readSurfaceDirectionFromClient(
      clientX: number,
      clientY: number,
      target: THREE.Vector3,
    ) {
      const rect = canvas.getBoundingClientRect()

      if (rect.width <= 0 || rect.height <= 0) {
        return false
      }

      pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1
      pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1
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

    function readSurfaceDirection(event: PointerEvent, target: THREE.Vector3) {
      return readSurfaceDirectionFromClient(event.clientX, event.clientY, target)
    }

    function releasePointer(pointerId: number) {
      if (canvas.hasPointerCapture(pointerId)) {
        canvas.releasePointerCapture(pointerId)
      }
    }

    function finishDrag(clearPointers = false) {
      if (activePointerId !== null && canvas.hasPointerCapture(activePointerId)) {
        canvas.releasePointerCapture(activePointerId)
      }

      if (clearPointers) {
        for (const pointerId of activePointers.keys()) {
          releasePointer(pointerId)
        }

        activePointers.clear()
      }

      activePointerId = null
      dragMode = 'none'
      canvas.classList.remove('surface-dragging')
      canvas.classList.remove('surface-depth')
      canvas.classList.remove('surface-tilt')
      canvas.classList.remove('surface-spin')
      canvas.classList.remove('surface-touch')
    }

    function handleLostPointerCapture() {
      finishDrag()
    }

    function pointerDistance(
      first: { clientX: number; clientY: number },
      second: { clientX: number; clientY: number },
    ) {
      return Math.hypot(first.clientX - second.clientX, first.clientY - second.clientY)
    }

    function pointerAngle(
      first: { clientX: number; clientY: number },
      second: { clientX: number; clientY: number },
    ) {
      return Math.atan2(second.clientY - first.clientY, second.clientX - first.clientX)
    }

    function pointerMoved(snapshot: {
      clientX: number
      clientY: number
      startX: number
      startY: number
    }) {
      return Math.hypot(snapshot.clientX - snapshot.startX, snapshot.clientY - snapshot.startY)
    }

    function setPointerSnapshot(event: PointerEvent) {
      activePointers.set(event.pointerId, {
        clientX: event.clientX,
        clientY: event.clientY,
        startX: event.clientX,
        startY: event.clientY,
        startedAt: performance.now(),
      })
    }

    function updatePointerSnapshot(event: PointerEvent) {
      const snapshot = activePointers.get(event.pointerId)

      if (!snapshot) {
        return
      }

      snapshot.clientX = event.clientX
      snapshot.clientY = event.clientY
    }

    function getTouchPair() {
      const snapshots = Array.from(activePointers.values())

      if (snapshots.length < 2) {
        return null
      }

      return [snapshots[0], snapshots[1]] as const
    }

    function startTouchGesture(event: PointerEvent) {
      const pair = getTouchPair()

      if (!pair || !targetRef.current) {
        return
      }

      const [first, second] = pair
      const centerX = (first.clientX + second.clientX) / 2
      const centerY = (first.clientY + second.clientY) / 2

      if (!readSurfaceDirectionFromClient(centerX, centerY, startDirection)) {
        startDirection.copy(camera.position).normalize()
      }

      orbitPivot.copy(startDirection).multiplyScalar(getCurrentFocusRadius())
      prepareOrbitFromPivot(orbitPivot)
      setSurfacePivotZoomLimits()
      orbitControls?.target.copy(orbitPivot)
      orbitControls?.update()

      touchStartCenter.set(centerX, centerY)
      touchStartDistance = Math.max(24, pointerDistance(first, second))
      touchStartAngle = pointerAngle(first, second)
      touchStartCameraDistance = Math.max(
        SURFACE_PIVOT_MIN_DISTANCE,
        orbitStartOffset.length(),
      )
      touchGestureStartedAt = performance.now()
      touchGestureMoved = false
      spinStartQuaternion.copy(targetRef.current.quaternion)
      touchTwistAxis.copy(orbitPivot).sub(camera.position)

      if (touchTwistAxis.lengthSq() < 0.0001) {
        camera.getWorldDirection(touchTwistAxis)
      }

      touchTwistAxis.normalize()
      activePointerId = null
      dragMode = 'touch'
      canvas.classList.remove('surface-dragging')
      canvas.classList.remove('surface-depth')
      canvas.classList.add('surface-touch')
      claimEvent(event)
    }

    function handleTouchGestureMove(event: PointerEvent) {
      const pair = getTouchPair()

      if (!pair || !targetRef.current) {
        return
      }

      const [first, second] = pair
      const centerX = (first.clientX + second.clientX) / 2
      const centerY = (first.clientY + second.clientY) / 2
      const distance = Math.max(24, pointerDistance(first, second))
      const angleDelta = Math.atan2(
        Math.sin(pointerAngle(first, second) - touchStartAngle),
        Math.cos(pointerAngle(first, second) - touchStartAngle),
      )

      touchCurrentCenter.set(centerX, centerY)

      const deltaX = (touchCurrentCenter.x - touchStartCenter.x) * 0.0022
      const deltaY = (touchCurrentCenter.y - touchStartCenter.y) * 0.0048
      const nextDistance = THREE.MathUtils.clamp(
        touchStartCameraDistance * (touchStartDistance / distance),
        orbitControls?.minDistance ?? SURFACE_PIVOT_MIN_DISTANCE,
        orbitControls?.maxDistance ?? SURFACE_PIVOT_MAX_DISTANCE,
      )

      applyOrbitFromStart(deltaX, deltaY, nextDistance)
      touchTwist.setFromAxisAngle(touchTwistAxis, -angleDelta)
      targetRef.current.quaternion.copy(touchTwist.multiply(spinStartQuaternion))

      if (
        Math.abs(distance - touchStartDistance) > 8 ||
        Math.abs(angleDelta) > 0.08 ||
        touchCurrentCenter.distanceTo(touchStartCenter) > 8
      ) {
        touchGestureMoved = true
      }

      claimEvent(event)
    }

    function startSurfaceDrag(event: PointerEvent) {
      if (!targetRef.current || !readSurfaceDirection(event, startDirection)) {
        return
      }

      activePointerId = event.pointerId
      dragMode = 'surface'
      pointerStart.set(event.clientX, event.clientY)
      initialQuaternion.copy(targetRef.current.quaternion)
      canvas.setPointerCapture(event.pointerId)
      canvas.classList.add('surface-dragging')
      claimEvent(event)
    }

    function handlePointerDown(event: PointerEvent) {
      if (!targetRef.current) {
        return
      }

      if (event.pointerType === 'touch') {
        setPointerSnapshot(event)
        canvas.setPointerCapture(event.pointerId)

        if (activePointers.size >= 2) {
          startTouchGesture(event)
          return
        }

        const now = performance.now()
        const isSecondTap =
          now - lastTapTime < 320 &&
          Math.hypot(event.clientX - lastTapX, event.clientY - lastTapY) < 34

        if (isSecondTap) {
          activePointerId = event.pointerId
          dragMode = 'tapZoom'
          pointerStart.set(event.clientX, event.clientY)
          tapZoomStartY = event.clientY
          tapZoomMoved = false
          zoomOffset.copy(camera.position).sub(orbitControls?.target ?? origin)
          tapZoomStartDistance = zoomOffset.length()
          canvas.classList.add('surface-depth')
          claimEvent(event)
          return
        }

        startSurfaceDrag(event)
        return
      }

      if (activePointerId !== null || activePointers.size > 0) {
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
        prepareOrbitFromPivot(orbitPivot)
        setSurfacePivotZoomLimits()
        orbitControls?.target.copy(orbitPivot)
        orbitControls?.update()
        canvas.setPointerCapture(event.pointerId)
        canvas.classList.add('surface-tilt')
        claimEvent(event)
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
        claimEvent(event)
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
        claimEvent(event)
        return
      }

      startSurfaceDrag(event)
    }

    function handlePointerMove(event: PointerEvent) {
      if (event.pointerType === 'touch') {
        updatePointerSnapshot(event)

        if (dragMode === 'touch') {
          handleTouchGestureMove(event)
          return
        }
      }

      if (activePointerId !== event.pointerId || !targetRef.current) {
        return
      }

      if (dragMode === 'orbit') {
        const deltaX = (event.clientX - shiftDragStart.x) * 0.0055
        const deltaY = (event.clientY - shiftDragStart.y) * 0.0055

        applyOrbitFromStart(deltaX, deltaY)
        claimEvent(event)
        return
      }

      if (dragMode === 'focus') {
        setFocusTarget(
          focusStartRadius - (event.clientY - focusDragStart.y) * FOCUS_TARGET_DRAG_SCALE,
          focusDirection,
        )
        claimEvent(event)
        return
      }

      if (dragMode === 'tapZoom') {
        const deltaY = event.clientY - tapZoomStartY

        if (Math.abs(deltaY) > 5) {
          tapZoomMoved = true
        }

        setDistanceFromActivePivot(tapZoomStartDistance - deltaY * 0.026)
        claimEvent(event)
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
        claimEvent(event)
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
      claimEvent(event)
    }

    function handlePointerUp(event: PointerEvent) {
      if (event.pointerType === 'touch') {
        const snapshot = activePointers.get(event.pointerId)
        const now = performance.now()

        updatePointerSnapshot(event)

        if (dragMode === 'touch') {
          if (!touchGestureMoved && now - touchGestureStartedAt < 320) {
            zoomFromActivePivot(0.9)
          }

          finishDrag(true)
          lastTapTime = 0
          claimEvent(event)
          return
        }

        if (dragMode === 'tapZoom' && activePointerId === event.pointerId) {
          if (!tapZoomMoved && snapshot && pointerMoved(snapshot) < 8) {
            zoomFromActivePivot(-0.9)
          }

          finishDrag(true)
          lastTapTime = 0
          claimEvent(event)
          return
        }

        if (activePointerId === event.pointerId) {
          const isTap =
            snapshot &&
            pointerMoved(snapshot) < 8 &&
            now - snapshot.startedAt < 280

          finishDrag(true)

          if (isTap) {
            if (
              now - lastTapTime < 320 &&
              Math.hypot(event.clientX - lastTapX, event.clientY - lastTapY) < 34
            ) {
              zoomFromActivePivot(-0.9)
              lastTapTime = 0
            } else {
              lastTapTime = now
              lastTapX = event.clientX
              lastTapY = event.clientY
            }
          }

          claimEvent(event)
        }

        return
      }

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
      const normalizedKey = event.key.toLowerCase()

      if (event.key === 'ArrowLeft' || normalizedKey === 'a') {
        targetRef.current.rotateY(rotateStep)
        event.preventDefault()
        return
      }

      if (event.key === 'ArrowRight' || normalizedKey === 'd') {
        targetRef.current.rotateY(-rotateStep)
        event.preventDefault()
        return
      }

      if (event.key === 'ArrowUp' || normalizedKey === 'w') {
        targetRef.current.rotateX(rotateStep)
        event.preventDefault()
        return
      }

      if (event.key === 'ArrowDown' || normalizedKey === 's') {
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
        return
      }

      if (normalizedKey === 'n' || normalizedKey === 'r') {
        resetMapCamera()
        event.preventDefault()
      }
    }

    function handleDoubleClick(event: MouseEvent) {
      zoomFromActivePivot(-0.9)
      claimEvent(event)
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

    function handleCameraCommand(event: Event) {
      const command = (event as CustomEvent<MapCameraCommand>).detail

      if (!targetRef.current) {
        return
      }

      if (command === 'zoom-in') {
        zoomFromActivePivot(-0.9)
        return
      }

      if (command === 'zoom-out') {
        zoomFromActivePivot(0.9)
        return
      }

      if (command === 'tilt-up') {
        orbitCameraBy(0, -0.18)
        return
      }

      if (command === 'tilt-down') {
        orbitCameraBy(0, 0.18)
        return
      }

      if (command === 'rotate-left') {
        targetRef.current.rotateY(0.18)
        return
      }

      if (command === 'rotate-right') {
        targetRef.current.rotateY(-0.18)
        return
      }

      resetMapCamera()
    }

    canvas.addEventListener('pointerdown', handlePointerDown)
    canvas.addEventListener('pointermove', handlePointerMove)
    canvas.addEventListener('pointerup', handlePointerUp)
    canvas.addEventListener('pointercancel', handlePointerUp)
    canvas.addEventListener('lostpointercapture', handleLostPointerCapture)
    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener(MAP_CAMERA_COMMAND_EVENT, handleCameraCommand)
    canvas.addEventListener('dblclick', handleDoubleClick, { capture: true })
    canvas.addEventListener('wheel', handleWheel, { capture: true, passive: false })
    canvas.addEventListener('contextmenu', handleContextMenu)

    return () => {
      finishDrag(true)
      canvas.removeEventListener('pointerdown', handlePointerDown)
      canvas.removeEventListener('pointermove', handlePointerMove)
      canvas.removeEventListener('pointerup', handlePointerUp)
      canvas.removeEventListener('pointercancel', handlePointerUp)
      canvas.removeEventListener('lostpointercapture', handleLostPointerCapture)
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener(MAP_CAMERA_COMMAND_EVENT, handleCameraCommand)
      canvas.removeEventListener('dblclick', handleDoubleClick, { capture: true })
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
