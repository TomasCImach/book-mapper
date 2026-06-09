import { describe, expect, it } from 'vitest'
import { resolveDeepLinkSelection } from './deepLinks'

describe('deep link selection', () => {
  it('opens book route pages at the completed route', () => {
    expect(
      resolveDeepLinkSelection(
        '/books/twenty-thousand-leagues-under-the-sea/route/',
        '',
      ),
    ).toEqual({
      bookId: 'twenty-thousand-leagues-under-the-sea',
      chapter: 46,
    })
  })

  it('opens chapter pages at the requested chapter', () => {
    expect(
      resolveDeepLinkSelection('/books/around-the-world-in-eighty-days/chapter-20/', ''),
    ).toEqual({
      bookId: 'around-the-world-in-eighty-days',
      chapter: 20,
    })
  })

  it('opens location pages at the waypoint chapter', () => {
    expect(resolveDeepLinkSelection('/locations/lofoten-maelstrom/', '')).toEqual({
      bookId: 'twenty-thousand-leagues-under-the-sea',
      chapter: 46,
    })
  })
})
