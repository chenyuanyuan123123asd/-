import React, { useState, useEffect } from 'react';

const Sudoku: React.FC = () => {
  const [board, setBoard] = useState<(number | null)[][]>(Array(9).fill(null).map(() => Array(9).fill(null)));
  const [initial, setInitial] = useState<boolean[][]>(Array(9).fill(false).map(() => Array(9).fill(false)));
  const [selected, setSelected] = useState<{r: number, c: number} | null>(null);

  const solveSudoku = (grid: (number | null)[][]): boolean => {
    for (let row = 0; row < 9; row++) {
      for (let col = 0; col < 9; col++) {
        if (grid[row][col] === null) {
          const nums = [1, 2, 3, 4, 5, 6, 7, 8, 9].sort(() => Math.random() - 0.5);
          for (let num of nums) {
            if (isValid(grid, row, col, num)) {
              grid[row][col] = num;
              if (solveSudoku(grid)) return true;
              grid[row][col] = null;
            }
          }
          return false;
        }
      }
    }
    return true;
  };

  const isValid = (grid: (number | null)[][], row: number, col: number, num: number) => {
    for (let i = 0; i < 9; i++) {
      if (grid[row][i] === num) return false;
      if (grid[i][col] === num) return false;
      const r = 3 * Math.floor(row / 3) + Math.floor(i / 3);
      const c = 3 * Math.floor(col / 3) + i % 3;
      if (grid[r][c] === num) return false;
    }
    return true;
  };

  const generateSudoku = () => {
    const newBoard: (number | null)[][] = Array(9).fill(null).map(() => Array(9).fill(null));
    solveSudoku(newBoard);
    
    const puzzle = newBoard.map(row => [...row]);
    const newInitial = Array(9).fill(false).map(() => Array(9).fill(false));
    
    // Remove some numbers to create the puzzle
    for (let i = 0; i < 9; i++) {
      for (let j = 0; j < 9; j++) {
        if (Math.random() > 0.4) {
          puzzle[i][j] = null;
        } else {
          newInitial[i][j] = true;
        }
      }
    }

    setBoard(puzzle);
    setInitial(newInitial);
  };

  useEffect(() => {
    generateSudoku();
  }, []);

  const handleCellClick = (r: number, c: number) => {
    if (initial[r][c]) return;
    setSelected({r, c});
  };

  const handleNumClick = (num: number) => {
    if (!selected) return;
    const newBoard = [...board.map(row => [...row])];
    newBoard[selected.r][selected.c] = board[selected.r][selected.c] === num ? null : num;
    setBoard(newBoard);
  };

  return (
    <div className="flex flex-col items-center">
      <div className="grid grid-cols-9 border-2 border-slate-800 mb-4 bg-white">
        {board.map((row, r) => row.map((cell, c) => (
          <div 
            key={`${r}-${c}`}
            onClick={() => handleCellClick(r, c)}
            className={`w-6 h-6 sm:w-7 sm:h-7 flex items-center justify-center text-xs border border-slate-200 cursor-pointer transition-colors
              ${(c + 1) % 3 === 0 && c < 8 ? 'border-r-2 border-r-slate-800' : ''}
              ${(r + 1) % 3 === 0 && r < 8 ? 'border-b-2 border-b-slate-800' : ''}
              ${selected?.r === r && selected?.c === c ? 'bg-blue-100' : ''}
              ${initial[r][c] ? 'font-bold text-slate-900 bg-slate-50' : 'text-blue-600'}
            `}
          >
            {cell || ''}
          </div>
        )))}
      </div>

      <div className="grid grid-cols-5 gap-1">
        {[1,2,3,4,5,6,7,8,9, 0].map(n => (
          <button
            key={n}
            onClick={() => n === 0 ? (selected && handleNumClick(0)) : handleNumClick(n)}
            className="w-8 h-8 rounded bg-slate-100 hover:bg-slate-200 text-sm font-medium border border-slate-300"
          >
            {n === 0 ? 'X' : n}
          </button>
        ))}
      </div>
      
      <button 
        onClick={generateSudoku}
        className="mt-4 text-[10px] text-slate-500 hover:underline"
      >
        Reset Puzzle
      </button>
    </div>
  );
};

export default Sudoku;
