import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Sparkles, 
  ChevronRight, 
  RotateCcw, 
  Loader2, 
  Shield, 
  Heart, 
  Briefcase, 
  MapPin, 
  ScrollText,
  History,
  Terminal,
  Skull
} from 'lucide-react';
import { GoogleGenAI, Type } from "@google/genai";

interface GameState {
  currentScene: string;
  choices: { id: string; text: string; consequence?: string }[];
  attributes: {
    health: number;
    sanity: number;
    inventory: string[];
    location: string;
  };
  history: { scene: string; action: string }[];
}

const StoryAdventure: React.FC = () => {
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [customAction, setCustomAction] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [theme, setTheme] = useState<'fantasy' | 'sci-fi' | 'noir' | 'horror'>('fantasy');
  const scrollRef = useRef<HTMLDivElement>(null);

  const ai = useMemo(() => {
    try {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) return null;
      return new GoogleGenAI({ apiKey });
    } catch (e) {
      console.warn('API Key access failed:', e);
      return null;
    }
  }, []);

  const startGame = async (selectedTheme?: typeof theme) => {
    if (!ai) {
      setError('系统配置错误：缺少 API 密钥');
      return;
    }
    setIsLoading(true);
    setError(null);
    const targetTheme = selectedTheme || theme;
    setTheme(targetTheme);

    try {
      const prompt = `你是一个顶级的跑团Dungeon Master。请为一个${targetTheme}风格的故事开局。
      要求：
      1. 生成初始场景描写（150字以内）。
      2. 生成3个具体的行动选项。
      3. 初始化玩家属性：血量(100)、理智(100)、初始物品、位置。
      
      请严格按照以下JSON格式返回：
      {
        "currentScene": "场景描写...",
        "choices": [
          {"id": "a", "text": "选项A..."},
          {"id": "b", "text": "选项B..."},
          {"id": "c", "text": "选项C..."}
        ],
        "attributes": {
          "health": 100,
          "sanity": 100,
          "inventory": ["物品1", "物品2"],
          "location": "起始位置"
        }
      }`;

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
        config: { responseMimeType: "application/json" }
      });

      const data = JSON.parse(response.text || '{}') as GameState;
      data.history = [];
      setGameState(data);
    } catch (e) {
      setError('数据加载失败，请重试。');
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAction = async (actionText: string) => {
    if (!gameState || isLoading || !ai) return;
    setIsLoading(true);
    setError(null);

    try {
      const prompt = `当前游戏状态：${JSON.stringify(gameState)}
      玩家选择了行动：${actionText}
      
      任务：
      1. 根据行动推进剧情。如果有危险，扣除血量或理智；如果有奖励，增加物品或恢复属性。
      2. 描写接下来的场景（150字以内）。
      3. 提供3个新的选项。
      4. 更新属性。
      
      返回JSON格式：
      {
        "currentScene": "新的场景描写...",
        "choices": [
          {"id": "...", "text": "..."}
        ],
        "attributes": {
          "health": number,
          "sanity": number,
          "inventory": ["String"],
          "location": "String"
        }
      }`;

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
        config: { responseMimeType: "application/json" }
      });

      const data = JSON.parse(response.text || '{}');
      
      setGameState(prev => {
        if (!prev) return null;
        return {
          ...data,
          history: [...prev.history, { scene: prev.currentScene, action: actionText }]
        };
      });
      setCustomAction('');
    } catch (e) {
      setError('连接超时，请重试操作。');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [gameState]);

  if (!gameState && !isLoading) {
    return (
      <div className="flex flex-col items-center justify-center p-6 text-center space-y-6 min-h-[400px]">
        <div className="w-16 h-16 bg-slate-50 border border-slate-100 rounded-full flex items-center justify-center text-slate-300">
          <ScrollText size={24} />
        </div>
        <div className="space-y-1">
          <h2 className="text-sm font-bold text-slate-700">AI 剧情冒险</h2>
          <p className="text-[10px] text-slate-400 max-w-xs mx-auto">
            选择一个世界观，开启一段由 AI 实时生成的旅程
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2 w-full max-w-[300px]">
          {(['fantasy', 'sci-fi', 'noir', 'horror'] as const).map(t => (
            <button
              key={t}
              onClick={() => startGame(t)}
              className="px-4 py-2 bg-white border border-slate-200 rounded-lg text-[10px] font-medium text-slate-600 hover:border-slate-400 hover:bg-slate-50 transition-all text-center"
            >
              {t === 'fantasy' && '🪄 奇幻'}
              {t === 'sci-fi' && '🚀 科幻'}
              {t === 'noir' && '🕵️ 探案'}
              {t === 'horror' && '👻 惊悚'}
            </button>
          ))}
        </div>
      </div>
    );
  }

  const isDead = gameState && (gameState.attributes.health <= 0 || gameState.attributes.sanity <= 0);

  return (
    <div className="flex flex-col h-[500px] max-w-full bg-white rounded-lg overflow-hidden border border-slate-200 font-sans">
      {/* HUD Header - Minimalist */}
      <div className="px-4 py-2 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-4 text-[9px] font-bold text-slate-400 uppercase tracking-tighter">
          <div className="flex items-center gap-1">
            <span>生命: {gameState?.attributes.health}</span>
          </div>
          <div className="flex items-center gap-1">
            <span>理智: {gameState?.attributes.sanity}</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 text-[9px] text-slate-400 font-medium">
            位置: {gameState?.attributes.location}
          </div>
          <button 
            onClick={() => setGameState(null)} 
            className="text-slate-300 hover:text-slate-500 transition-colors"
          >
            <RotateCcw size={12} />
          </button>
        </div>
      </div>

      {/* Main Content Area - Document Look */}
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-6 space-y-8 scroll-smooth"
      >
        {gameState?.history.map((h, i) => (
          <div key={i} className="opacity-30 space-y-2 border-l border-slate-100 pl-4">
            <div className="text-[10px] leading-relaxed text-slate-500">
              {h.scene}
            </div>
            <div className="text-[9px] font-bold text-slate-600 flex items-center gap-1 italic">
              选择：{h.action}
            </div>
          </div>
        ))}

        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="space-y-6"
        >
          <div className="text-xs leading-7 text-slate-700 font-normal">
            {gameState?.currentScene}
          </div>

          {!isDead && !isLoading && (
            <div className="space-y-1.5 pt-4">
              {gameState?.choices.map((choice, idx) => (
                <button
                  key={idx}
                  onClick={() => handleAction(choice.text)}
                  className="w-full text-left px-4 py-2.5 bg-slate-50 border border-slate-100 rounded-lg text-[10px] text-slate-600 hover:bg-slate-100 hover:border-slate-200 transition-all flex items-center gap-3"
                >
                  <span className="text-slate-300 font-mono italic">#{idx + 1}</span>
                  {choice.text}
                </button>
              ))}
              <div className="flex gap-2 mt-4">
                <input 
                  type="text"
                  value={customAction}
                  onChange={(e) => setCustomAction(e.target.value)}
                  placeholder="自定行动..."
                  onKeyDown={(e) => e.key === 'Enter' && customAction.trim() && handleAction(customAction)}
                  className="flex-1 bg-white border border-slate-200 rounded-lg px-3 py-2 text-[10px] text-slate-600 focus:outline-none focus:border-slate-300"
                />
                <button 
                  onClick={() => handleAction(customAction)}
                  disabled={!customAction.trim()}
                  className="px-3 bg-slate-100 text-slate-400 border border-slate-200 rounded-lg hover:bg-slate-200 disabled:opacity-50 transition-all"
                >
                   <ChevronRight size={14} />
                </button>
              </div>
            </div>
          )}

          {isLoading && (
            <div className="flex flex-col items-center justify-center py-6 gap-2">
              <Loader2 className="animate-spin text-slate-200" size={18} />
              <span className="text-[9px] font-medium text-slate-300 tracking-[0.2em] uppercase">故事生成中...</span>
            </div>
          )}

          {isDead && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="p-6 bg-rose-50/50 border border-rose-100 rounded-xl text-center space-y-3"
            >
              <div className="text-[10px] font-bold text-rose-400 uppercase tracking-widest">
                命运在此终结
              </div>
              <button 
                onClick={() => setGameState(null)}
                className="px-5 py-1.5 bg-rose-100 text-rose-700 border border-rose-200 rounded-full text-[9px] font-bold hover:bg-rose-200 transition-all"
              >
                开启新人生
              </button>
            </motion.div>
          )}

          {error && (
            <div className="py-2 text-center text-[9px] text-rose-400">
              {error}
            </div>
          )}
        </motion.div>
      </div>

      {/* Footer Inventory Bar - Subdued */}
      <div className="px-4 py-2 bg-slate-50 border-t border-slate-100 flex items-center gap-3 overflow-x-auto no-scrollbar">
        <div className="text-[9px] font-bold text-slate-300 uppercase shrink-0">物品清单:</div>
        <div className="flex gap-1.5">
          {gameState?.attributes.inventory.map((item, i) => (
            <span key={i} className="px-1.5 py-0.5 border border-slate-200 text-[8px] text-slate-400 rounded whitespace-nowrap">
              {item}
            </span>
          ))}
          {gameState?.attributes.inventory.length === 0 && (
            <span className="text-[8px] text-slate-300 italic">空空如也</span>
          )}
        </div>
      </div>
    </div>
  );
};

export default StoryAdventure;
