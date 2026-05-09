import React, { useState, useEffect, useCallback } from 'react';

type Cell = {
  isMine: boolean;
  isRevealed: boolean;
  isFlagged: boolean;
  neighborCount: number;
};

const Minesweeper: React.FC = () => {
  const [grid, setGrid] = useState<Cell[][]>([]);
  const [status, setStatus] = useState<'playing' | 'won' | 'lost'>('playing');
  const size = 10;
  const mineCount = 10;

  const initGame = useCallback(() => {
    const newGrid: Cell[][] = Array(size).fill(null).map(() => 
      Array(size).fill(null).map(() => ({
        isMine: false,
        isRevealed: false,
        isFlagged: false,
        neighborCount: 0
      }))
    );

    // Place mines
    let placed = 0;
    while (placed < mineCount) {
      const r = Math.floor(Math.random() * size);
      const c = Math.floor(Math.random() * size);
      if (!newGrid[r][c].isMine) {
        newGrid[r][c].isMine = true;
        placed++;
      }
    }

    // Calculate neighbors
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if (!newGrid[r][c].isMine) {
          let count = 0;
          for (let dr = -1; dr <= 1; dr++) {
            for (let dc = -1; dc <= 1; dc++) {
              const nr = r + dr, nc = c + dc;
              if (nr >= 0 && nr < size && nc >= 0 && nc < size && newGrid[nr][nc].isMine) {
                count++;
              }
            }
          }
          newGrid[r][c].neighborCount = count;
        }
      }
    }

    setGrid(newGrid);
    setStatus('playing');
  }, []);

  useEffect(() => {
    initGame();
  }, [initGame]);

  const reveal = (r: number, c: number) => {
    if (status !== 'playing' || grid[r][c].isRevealed || grid[r][c].isFlagged) return;

    const newGrid = [...grid.map(row => [...row])];
    
    if (newGrid[r][c].isMine) {
      // Game Over
      newGrid.forEach(row => row.forEach(cell => { if (cell.isMine) cell.isRevealed = true; }));
      setGrid(newGrid);
      setStatus('lost');
      return;
    }

    const floodFill = (row: number, col: number) => {
      if (row < 0 || row >= size || col < 0 || col >= size || newGrid[row][col].isRevealed || newGrid[row][col].isFlagged) return;
      newGrid[row][col].isRevealed = true;
      if (newGrid[row][col].neighborCount === 0) {
        for (let dr = -1; dr <= 1; dr++) {
          for (let dc = -1; dc <= 1; dc++) {
            floodFill(row + dr, col + dc);
          }
        }
      }
    };

    floodFill(r, c);
    
    // Check win
    let unrevealedSafe = 0;
    newGrid.forEach(row => row.forEach(cell => {
      if (!cell.isMine && !cell.isRevealed) unrevealedSafe++;
    }));

    setGrid(newGrid);
    if (unrevealedSafe === 0) setStatus('won');
  };

  const toggleFlag = (e: React.MouseEvent, r: number, c: number) => {
    e.preventDefault();
    if (status !== 'playing' || grid[r][c].isRevealed) return;
    const newGrid = [...grid.map(row => [...row])];
    newGrid[r][c].isFlagged = !newGrid[r][c].isFlagged;
    setGrid(newGrid);
  };

  return (
    <div className="flex flex-col items-center">
      <div className="flex justify-between w-full mb-3 px-1 text-xs font-bold text-slate-500 uppercase">
        <span>{status === 'playing' ? 'Mines: ' + mineCount : status.toUpperCase()}</span>
        <button onClick={initGame} className="bg-slate-100 px-2 py-0.5 rounded hover:bg-slate-200">Restart</button>
      </div>
      
      <div className="grid grid-cols-10 gap-0.5 bg-slate-200 border-2 border-slate-300 p-0.5">
        {grid.map((row, r) => row.map((cell, c) => (
          <div
            key={`${r}-${c}`}
            onClick={() => reveal(r, c)}
            onContextMenu={(e) => toggleFlag(e, r, c)}
            className={`w-6 h-6 flex items-center justify-center text-[10px] cursor-pointer select-none
              ${cell.isRevealed 
                ? (cell.isMine ? 'bg-red-500' : 'bg-slate-50') 
                : 'bg-slate-400 hover:bg-slate-300 shadow-[inset_1px_1px_0_white,inset_-1px_-1px_0_rgba(0,0,0,0.2)]'}
            `}
          >
            {cell.isRevealed && !cell.isMine && cell.neighborCount > 0 && (
              <span className={
                cell.neighborCount === 1 ? 'text-blue-600' :
                cell.neighborCount === 2 ? 'text-green-600' :
                cell.neighborCount === 3 ? 'text-red-500' :
                'text-purple-600'
              }>
                {cell.neighborCount}
              </span>
            )}
            {cell.isRevealed && cell.isMine && '💣'}
            {!cell.isRevealed && cell.isFlagged && '🚩'}
          </div>
        )))}
      </div>
      <p className="mt-2 text-[10px] text-slate-400">Right-click to flag</p>
    </div>
  );
};

export default Minesweeper;
