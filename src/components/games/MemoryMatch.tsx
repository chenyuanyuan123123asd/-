import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';

const EMOJIS = ['🍎', '🍇', '🍋', '🍒', '🥑', '🥦', '🍦', '🍩'];

const MemoryMatch: React.FC = () => {
  const [cards, setCards] = useState<{ id: number, emoji: string, isFlipped: boolean, isMatched: boolean }[]>([]);
  const [flipped, setFlipped] = useState<number[]>([]);
  const [moves, setMoves] = useState(0);

  const initGame = () => {
    const deck = [...EMOJIS, ...EMOJIS]
      .sort(() => Math.random() - 0.5)
      .map((emoji, index) => ({
        id: index,
        emoji,
        isFlipped: false,
        isMatched: false,
      }));
    setCards(deck);
    setFlipped([]);
    setMoves(0);
  };

  useEffect(() => {
    initGame();
  }, []);

  const handleFlip = (id: number) => {
    if (flipped.length === 2 || cards[id].isFlipped || cards[id].isMatched) return;

    const newCards = [...cards];
    newCards[id].isFlipped = true;
    setCards(newCards);

    const newFlipped = [...flipped, id];
    setFlipped(newFlipped);

    if (newFlipped.length === 2) {
      setMoves(m => m + 1);
      const [first, second] = newFlipped;
      if (cards[first].emoji === cards[second].emoji) {
        setTimeout(() => {
          setCards(prev => prev.map(c => 
            (c.id === first || c.id === second) ? { ...c, isMatched: true } : c
          ));
          setFlipped([]);
        }, 500);
      } else {
        setTimeout(() => {
          setCards(prev => prev.map(c => 
            (c.id === first || c.id === second) ? { ...c, isFlipped: false } : c
          ));
          setFlipped([]);
        }, 1000);
      }
    }
  };

  const isWon = cards.length > 0 && cards.every(c => c.isMatched);

  return (
    <div className="flex flex-col items-center">
      <div className="flex justify-between w-full mb-3 px-1 text-[10px] font-black text-slate-400 uppercase tracking-widest">
        <span>Moves: {moves}</span>
        <button onClick={initGame} className="hover:text-slate-600 transition-colors">Reset</button>
      </div>

      <div className="grid grid-cols-4 gap-2 bg-slate-50 p-2 rounded-xl">
        {cards.map((card) => (
          <motion.div
            key={card.id}
            onClick={() => handleFlip(card.id)}
            animate={{ rotateY: card.isFlipped || card.isMatched ? 180 : 0 }}
            className={`w-12 h-12 rounded-lg cursor-pointer flex items-center justify-center text-xl shadow-sm transition-colors ${
              card.isMatched ? 'bg-emerald-50' : card.isFlipped ? 'bg-white' : 'bg-indigo-500'
            }`}
          >
            {(card.isFlipped || card.isMatched) ? (
              <span style={{ transform: 'rotateY(180deg)' }}>{card.emoji}</span>
            ) : null}
          </motion.div>
        ))}
      </div>

      {isWon && (
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="mt-4 text-emerald-600 font-black text-[10px] uppercase tracking-[0.2em]"
        >
          Excellent Memory! 🎉
        </motion.div>
      )}
    </div>
  );
};

export default MemoryMatch;
