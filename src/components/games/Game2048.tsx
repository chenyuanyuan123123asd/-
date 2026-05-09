import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';

type Tile = {
  id: number;
  value: number;
  x: number;
  y: number;
  mergedFrom?: number[];
};

const Game2048: React.FC = () => {
  const [tiles, setTiles] = useState<Tile[]>([]);
  const [score, setScore] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [nextId, setNextId] = useState(1);

  const initGame = useCallback(() => {
    setTiles([]);
    setScore(0);
    setGameOver(false);
    
    // Add initial tiles
    let id = 1;
    const initialTiles: Tile[] = [];
    
    const getPos = () => {
      const x = Math.floor(Math.random() * 4);
      const y = Math.floor(Math.random() * 4);
      if (initialTiles.some(t => t.x === x && t.y === y)) return getPos();
      return { x, y };
    };

    const p1 = getPos();
    initialTiles.push({ id: id++, value: 2, x: p1.x, y: p1.y });
    const p2 = getPos();
    initialTiles.push({ id: id++, value: 2, x: p2.x, y: p2.y });
    
    setTiles(initialTiles);
    setNextId(id);
  }, []);

  useEffect(() => {
    initGame();
  }, [initGame]);

  const addTile = (currentTiles: Tile[]) => {
    const occupied = new Set(currentTiles.map(t => `${t.x},${t.y}`));
    const options = [];
    for (let x = 0; x < 4; x++) {
      for (let y = 0; y < 4; y++) {
        if (!occupied.has(`${x},${y}`)) options.push({ x, y });
      }
    }
    if (options.length > 0) {
      const spot = options[Math.floor(Math.random() * options.length)];
      setTiles(prev => [
        ...prev, 
        { id: nextId, value: Math.random() > 0.1 ? 2 : 4, x: spot.x, y: spot.y }
      ]);
      setNextId(prev => prev + 1);
    }
  };

  const move = (direction: 'up' | 'down' | 'left' | 'right') => {
    if (gameOver) return;

    let moved = false;
    let currentScore = score;
    const newTiles: Tile[] = JSON.parse(JSON.stringify(tiles));
    
    // Group tiles by row or column depending on direction
    const isVertical = direction === 'up' || direction === 'down';
    const isReverse = direction === 'right' || direction === 'down';

    for (let i = 0; i < 4; i++) {
      const line = newTiles.filter(t => (isVertical ? t.x : t.y) === i);
      // Sort tiles based on coordinate in direction of movement
      line.sort((a, b) => (isVertical ? a.y - b.y : a.x - b.x));
      if (isReverse) line.reverse();

      let targetPos = isReverse ? 3 : 0;
      let lastTile: Tile | null = null;

      for (let j = 0; j < line.length; j++) {
        const tile = line[j];
        // Clear previous merge info for this turn
        delete tile.mergedFrom;
        
        if (lastTile && lastTile.value === tile.value && !lastTile.mergedFrom) {
          // Merge current tile INTO the lastTile
          const oldX = tile.x;
          const oldY = tile.y;
          
          // Move this tile to the lastTile's physical position for the animation
          tile.x = lastTile.x;
          tile.y = lastTile.y;
          
          // Double the value of the tile that stayed
          lastTile.value *= 2;
          lastTile.mergedFrom = [lastTile.id, tile.id]; // Mark as merged so it doesn't merge again this turn
          currentScore += lastTile.value;
          
          tile.value = 0; // Mark current tile for removal after move animation
          moved = true;
        } else {
          // No merge, just slide to next available position
          const oldX = tile.x;
          const oldY = tile.y;
          
          if (isVertical) tile.y = targetPos;
          else tile.x = targetPos;
          
          if (tile.x !== oldX || tile.y !== oldY) moved = true;
          
          lastTile = tile;
          targetPos += isReverse ? -1 : 1;
        }
      }
    }

    if (moved) {
      const filtered = newTiles.filter(t => t.value > 0);
      setTiles(filtered);
      setScore(currentScore);
      addTile(filtered);
      checkGameOver(filtered);
    }
  };

  const checkGameOver = (currentTiles: Tile[]) => {
    if (currentTiles.length < 16) return;
    
    // Check if any merges are possible
    const grid: number[][] = Array(4).fill(null).map(() => Array(4).fill(0));
    currentTiles.forEach(t => grid[t.y][t.x] = t.value);

    for (let y = 0; y < 4; y++) {
      for (let x = 0; x < 4; x++) {
        if (x < 3 && grid[y][x] === grid[y][x + 1]) return;
        if (y < 3 && grid[y][x] === grid[y + 1][x]) return;
      }
    }
    setGameOver(true);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowUp') move('up');
      if (e.key === 'ArrowDown') move('down');
      if (e.key === 'ArrowLeft') move('left');
      if (e.key === 'ArrowRight') move('right');
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [tiles, gameOver]);

  return (
    <div className="flex flex-col items-center select-none">
      <div className="flex justify-between w-full mb-4 px-2">
        <div className="bg-slate-100/50 backdrop-blur-sm px-3 py-1 rounded-md border border-slate-200/50">
          <p className="text-[10px] text-slate-400 uppercase font-black">Score</p>
          <p className="text-lg font-black text-slate-700 leading-none">{score}</p>
        </div>
        <button 
          onClick={initGame}
          className="bg-slate-800 text-white text-[10px] uppercase font-black px-4 py-1 rounded-full hover:bg-slate-900 transition-all shadow-sm"
        >
          Reset
        </button>
      </div>

      <div className="bg-slate-200/80 p-2 rounded-xl relative w-[240px] h-[240px]">
        {/* Background Grid */}
        <div className="absolute inset-2 grid grid-cols-4 grid-rows-4 gap-2">
          {Array(16).fill(0).map((_, i) => (
            <div key={i} className="bg-slate-300/50 rounded-lg" />
          ))}
        </div>

        {/* Dynamic Tiles */}
        <div className="absolute inset-2">
          <AnimatePresence>
            {tiles.map((tile) => (
              <motion.div 
                key={tile.id}
                layoutId={`tile-${tile.id}`}
                layout
                initial={{ scale: 0, opacity: 0 }}
                animate={{ 
                  scale: 1, 
                  opacity: 1,
                  left: `${tile.x * 25}%`,
                  top: `${tile.y * 25}%`
                }}
                transition={{
                  layout: { type: "spring", stiffness: 500, damping: 40 },
                  opacity: { duration: 0.05 }
                }}
                className={`absolute w-[50px] h-[50px] flex items-center justify-center rounded-lg text-lg font-black shadow-sm ${
                  tile.value === 2 ? 'bg-white text-slate-600' :
                  tile.value === 4 ? 'bg-slate-50 text-slate-600 border border-slate-100' :
                  tile.value === 8 ? 'bg-orange-100 text-orange-700' :
                  tile.value === 16 ? 'bg-orange-200 text-orange-800' :
                  tile.value === 32 ? 'bg-orange-400 text-white' :
                  tile.value === 64 ? 'bg-rose-400 text-white' :
                  tile.value === 128 ? 'bg-rose-500 text-white shadow-rose-200 shadow-lg' :
                  tile.value === 256 ? 'bg-indigo-500 text-white' :
                  tile.value === 512 ? 'bg-indigo-600 text-white' :
                  tile.value === 1024 ? 'bg-violet-600 text-white' :
                  'bg-amber-400 text-white'
                }`}
                style={{
                  width: 'calc(25% - 8px)',
                  height: 'calc(25% - 8px)',
                  margin: '4px'
                }}
              >
                {tile.value}
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        {gameOver && (
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-md flex flex-col items-center justify-center text-white rounded-xl z-20">
            <p className="text-2xl font-black mb-4 tracking-tight">GAME OVER</p>
            <button onClick={initGame} className="bg-white text-slate-900 px-6 py-2 rounded-full text-xs font-black uppercase tracking-widest shadow-xl transform active:scale-95 transition-transform">
              Try Again
            </button>
          </div>
        )}
      </div>
      <p className="mt-4 text-[9px] text-slate-400 font-bold uppercase tracking-widest">Connect the numbers!</p>
    </div>
  );
};

export default Game2048;
