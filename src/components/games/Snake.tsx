import React, { useState, useEffect, useCallback, useRef } from 'react';

type Point = { x: number, y: number };

const Snake: React.FC = () => {
  const [snake, setSnake] = useState<Point[]>([{ x: 5, y: 5 }]);
  const [food, setFood] = useState<Point>({ x: 10, y: 10 });
  const [direction, setDirection] = useState<'UP' | 'DOWN' | 'LEFT' | 'RIGHT'>('RIGHT');
  const [gameOver, setGameOver] = useState(false);
  const [score, setScore] = useState(0);
  const gridSize = 15;

  const generateFood = useCallback((currentSnake: Point[]) => {
    let newFood;
    while (true) {
      newFood = {
        x: Math.floor(Math.random() * gridSize),
        y: Math.floor(Math.random() * gridSize)
      };
      if (!currentSnake.some(p => p.x === newFood.x && p.y === newFood.y)) break;
    }
    return newFood;
  }, []);

  const resetGame = () => {
    setSnake([{ x: 5, y: 5 }]);
    setFood({ x: 10, y: 10 });
    setDirection('RIGHT');
    setGameOver(false);
    setScore(0);
  };

  const moveSnake = useCallback(() => {
    if (gameOver) return;

    setSnake(prevSnake => {
      const head = prevSnake[0];
      const newHead = { ...head };

      if (direction === 'UP') newHead.y -= 1;
      if (direction === 'DOWN') newHead.y += 1;
      if (direction === 'LEFT') newHead.x -= 1;
      if (direction === 'RIGHT') newHead.x += 1;

      // Check walls
      if (newHead.x < 0 || newHead.x >= gridSize || newHead.y < 0 || newHead.y >= gridSize) {
        setGameOver(true);
        return prevSnake;
      }

      // Check self collision
      if (prevSnake.some(p => p.x === newHead.x && p.y === newHead.y)) {
        setGameOver(true);
        return prevSnake;
      }

      const newSnake = [newHead, ...prevSnake];

      // Check food
      if (newHead.x === food.x && newHead.y === food.y) {
        setScore(s => s + 1);
        setFood(generateFood(newSnake));
      } else {
        newSnake.pop();
      }

      return newSnake;
    });
  }, [direction, food, gameOver, generateFood]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowUp' && direction !== 'DOWN') setDirection('UP');
      if (e.key === 'ArrowDown' && direction !== 'UP') setDirection('DOWN');
      if (e.key === 'ArrowLeft' && direction !== 'RIGHT') setDirection('LEFT');
      if (e.key === 'ArrowRight' && direction !== 'LEFT') setDirection('RIGHT');
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [direction]);

  useEffect(() => {
    const interval = setInterval(moveSnake, 150);
    return () => clearInterval(interval);
  }, [moveSnake]);

  return (
    <div className="flex flex-col items-center">
      <div className="flex justify-between w-full mb-2 text-xs font-bold text-slate-500 uppercase px-1">
        <span>Score: {score}</span>
        <button onClick={resetGame} className="hover:underline">Reset</button>
      </div>

      <div 
        className="relative bg-slate-100 border-2 border-slate-200 rounded-lg overflow-hidden"
        style={{ width: gridSize * 16, height: gridSize * 16 }}
      >
        {snake.map((p, i) => (
          <div 
            key={i}
            className={`absolute rounded-sm ${i === 0 ? 'bg-emerald-500 z-10' : 'bg-emerald-400'}`}
            style={{ 
              width: 14, height: 14, 
              left: p.x * 16 + 1, top: p.y * 16 + 1,
              transition: 'all 0.1s linear'
            }}
          />
        ))}
        <div 
          className="absolute bg-rose-500 rounded-full"
          style={{ width: 10, height: 10, left: food.x * 16 + 3, top: food.y * 16 + 3 }}
        />

        {gameOver && (
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm flex flex-col items-center justify-center p-4">
            <p className="text-white font-bold text-lg mb-2">Game Over!</p>
            <button onClick={resetGame} className="bg-white text-slate-900 px-4 py-1 rounded-full text-xs font-bold">Restart</button>
          </div>
        )}
      </div>
      <p className="mt-2 text-[9px] text-slate-400">Use arrow keys to control</p>
    </div>
  );
};

export default Snake;
