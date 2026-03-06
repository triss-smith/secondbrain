import { useCallback, useEffect, useState } from 'react'
import { createBoard, getBoard, listBoards, saveBoardState } from '../api'
import type { Board, BoardState } from '../types'

export function useBoard() {
  const [board, setBoard] = useState<Board | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function init() {
      try {
        const boards = await listBoards()
        if (boards.length > 0) {
          setBoard(boards[0])
        } else {
          const newBoard = await createBoard('My Brain')
          setBoard(newBoard)
        }
      } catch (e) {
        console.error('Failed to load board', e)
      } finally {
        setLoading(false)
      }
    }
    init()
  }, [])

  const saveState = useCallback(
    async (state: BoardState) => {
      if (!board) return
      try {
        await saveBoardState(board.id, state)
        setBoard(prev => (prev ? { ...prev, state } : prev))
      } catch (e) {
        console.error('Failed to save board state', e)
      }
    },
    [board]
  )

  const refreshBoard = useCallback(async () => {
    if (!board) return
    const updated = await getBoard(board.id)
    setBoard(updated)
  }, [board])

  return { board, loading, saveState, refreshBoard }
}
