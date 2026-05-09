import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Gamepad2, X, Trophy, Puzzle, Bomb, Ghost, Grid3X3, Brain } from 'lucide-react';
import Game2048 from './Game2048';
import Sudoku from './Sudoku';
import Minesweeper from './Minesweeper';
import Snake from './Snake';
import MemoryMatch from './MemoryMatch';

const GameWidget: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [activeGame, setActiveGame] = useState<'2048' | 'sudoku' | 'mines' | 'snake' | 'memory'>('2048');
  const constraintsRef = useRef(null);

  return (
    <div className="fixed inset-0 pointer-events-none z-[9999]" ref={constraintsRef}>
      <motion.div
        drag
        dragElastic={0.1}
        dragConstraints={constraintsRef}
        dragMomentum={false}
        className="absolute bottom-8 right-0 pointer-events-auto"
        initial={{ x: 20 }}
      >
        <AnimatePresence>
          {!isOpen && (
            <motion.button
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 0.4, x: 15 }}
              whileHover={{ opacity: 1, x: 0 }}
              onClick={() => setIsOpen(true)}
              className="w-12 h-10 rounded-l-2xl bg-white/40 backdrop-blur-md flex items-center justify-start pl-3 text-slate-600 shadow-sm border border-white/20 overflow-hidden group border-r-0"
              title="Relax..."
            >
              <Gamepad2 size={24} className="transition-transform group-hover:rotate-12" />
            </motion.button>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {isOpen && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9, x: -10 }}
              animate={{ opacity: 1, scale: 1, x: -20 }}
              exit={{ opacity: 0, scale: 0.9, x: -10 }}
              className="bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/20 overflow-hidden w-[280px] sm:w-[320px] p-1 absolute bottom-0 right-0 origin-bottom-right"
            >
              {/* Header */}
              <div className="flex items-center justify-between p-3 border-b border-slate-100 bg-slate-50/30 rounded-t-xl">
                <div className="flex gap-1 p-0.5 bg-slate-100 rounded-lg overflow-x-auto no-scrollbar max-w-[220px]">
                  <button
                    onClick={() => setActiveGame('2048')}
                    className={`flex flex-shrink-0 items-center gap-1.5 px-2.5 py-1 rounded-md text-[9px] font-bold uppercase transition-all ${
                      activeGame === '2048' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-600'
                    }`}
                  >
                    <Trophy size={11} />
                    2048
                  </button>
                  <button
                    onClick={() => setActiveGame('snake')}
                    className={`flex flex-shrink-0 items-center gap-1.5 px-2.5 py-1 rounded-md text-[9px] font-bold uppercase transition-all ${
                      activeGame === 'snake' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-600'
                    }`}
                  >
                    <Ghost size={11} />
                    Snake
                  </button>
                  <button
                    onClick={() => setActiveGame('memory')}
                    className={`flex flex-shrink-0 items-center gap-1.5 px-2.5 py-1 rounded-md text-[9px] font-bold uppercase transition-all ${
                      activeGame === 'memory' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-600'
                    }`}
                  >
                    <Brain size={11} />
                    Memory
                  </button>
                  <button
                    onClick={() => setActiveGame('sudoku')}
                    className={`flex flex-shrink-0 items-center gap-1.5 px-2.5 py-1 rounded-md text-[9px] font-bold uppercase transition-all ${
                      activeGame === 'sudoku' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-600'
                    }`}
                  >
                    <Puzzle size={11} />
                    Sudoku
                  </button>
                  <button
                    onClick={() => setActiveGame('mines')}
                    className={`flex flex-shrink-0 items-center gap-1.5 px-2.5 py-1 rounded-md text-[9px] font-bold uppercase transition-all ${
                      activeGame === 'mines' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-600'
                    }`}
                  >
                    <Bomb size={11} />
                    Mines
                  </button>
                </div>
                <button 
                  onClick={() => setIsOpen(false)}
                  className="p-1 hover:bg-slate-200 rounded-full text-slate-400 transition-colors flex-shrink-0"
                  title="Close"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Game Body */}
              <div className="p-4 bg-white rounded-b-xl overflow-y-auto max-h-[400px]">
                {activeGame === '2048' && <Game2048 />}
                {activeGame === 'snake' && <Snake />}
                {activeGame === 'memory' && <MemoryMatch />}
                {activeGame === 'sudoku' && <Sudoku />}
                {activeGame === 'mines' && <Minesweeper />}
              </div>
              
              <div className="p-2 text-center border-t border-slate-50 cursor-move">
                 <p className="text-[10px] text-slate-300">Drag me anywhere!</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
};

export default GameWidget;
