/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback, ChangeEvent } from 'react';
import { 
  Settings, 
  Database, 
  Sparkles, 
  Search, 
  Trash2, 
  Plus, 
  ChevronDown, 
  AlertCircle,
  CheckCircle2,
  Send,
  Loader2,
  ArrowRight,
  ClipboardList,
  Camera,
  Download,
  Menu,
  Check,
  MapPin,
  X
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut } from 'firebase/auth';
import { 
  getFirestore, 
  collection, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  onSnapshot, 
  query, 
  orderBy,
  setDoc,
  serverTimestamp
} from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

// --- Firebase Initialization ---
const app = initializeApp(firebaseConfig);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
const auth = getAuth(app);

// --- Types ---

declare global {
  interface Window {
    AMap: any;
    _AMapSecurityConfig: any;
  }
}

interface ApiConfig {
  url: string;
  key: string;
  model: string;
}

interface ApiProfile {
  id: string;
  name: string;
  config: ApiConfig;
}

interface Property {
  id: string;
  name: string;
  area: string;
  address?: string;
  totalPrice: string;
  totalPriceValue?: number; // Normalized price for sorting/matching
  downPayment: string;
  layout: string;
  status: string;
  sellingPoints: string;
  nearbyFacilities?: string;
  imageUrl?: string;
  videoUrl?: string;
  saleFloor?: string; // 在售楼层
  saleArea?: string;  // 在售面积
  projectBrief?: string; // 项目资料
  createdAt: number;
}

interface MatchMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

interface ExtractionResult {
  项目名: string;
  区域: string;
  地址?: string;
  总价: string;
  总价数值?: number; 
  首付: string;
  面积与户型: string;
  交房状态: string;
  核心卖点: string;
  附近配套?: string;
  在售楼层?: string;
  在售面积?: string;
  项目资料?: string;
}

type ThemeMode = 'pink' | 'purple' | 'blue' | 'yellow' | 'green' | 'orange' | 'teal' | 'indigo';

interface ThemeConfig {
  primary: string;
  secondary: string;
  bg: string;
  accent: string;
  gradient: string;
  label: string;
}

const THEMES: Record<ThemeMode, ThemeConfig> = {
  pink: { primary: 'text-rose-400', secondary: 'bg-rose-300', bg: 'bg-rose-50', accent: 'bg-rose-100/50', gradient: 'bg-theme-pink', label: '草莓圣代' },
  purple: { primary: 'text-purple-400', secondary: 'bg-purple-300', bg: 'bg-purple-50', accent: 'bg-purple-100/50', gradient: 'bg-theme-purple', label: '香芋奶冻' },
  blue: { primary: 'text-sky-400', secondary: 'bg-sky-300', bg: 'bg-sky-50', accent: 'bg-sky-100/50', gradient: 'bg-theme-blue', label: '晴空冰沙' },
  yellow: { primary: 'text-amber-400', secondary: 'bg-amber-300', bg: 'bg-amber-50', accent: 'bg-amber-100/50', gradient: 'bg-theme-yellow', label: '芝士布丁' },
  green: { primary: 'text-emerald-400', secondary: 'bg-emerald-300', bg: 'bg-emerald-50', accent: 'bg-emerald-100/50', gradient: 'bg-theme-green', label: '青提软糖' },
  orange: { primary: 'text-orange-400', secondary: 'bg-orange-300', bg: 'bg-orange-50', accent: 'bg-orange-100/50', gradient: 'bg-theme-orange', label: '西柚多多' },
  teal: { primary: 'text-teal-400', secondary: 'bg-teal-300', bg: 'bg-teal-50', accent: 'bg-teal-100/50', gradient: 'bg-theme-teal', label: '薄荷苏打' },
  indigo: { primary: 'text-indigo-400', secondary: 'bg-indigo-300', bg: 'bg-indigo-50', accent: 'bg-indigo-100/50', gradient: 'bg-theme-indigo', label: '盐系苏蓝' }
};

// --- Utils ---

const STORAGE_KEYS = {
  CONFIG: 'sh_apt_helper_config',
  PROPERTIES: 'sh_apt_helper_properties',
  THEME: 'sh_apt_helper_theme'
};

const DEFAULT_CONFIG: ApiConfig = {
  url: 'https://api.openai.com/v1/chat/completions',
  key: '',
  model: 'gemini-1.5-flash'
};

export default function App() {
  // --- State ---
  const [activeTab, setActiveTab] = useState<'config' | 'input' | 'database' | 'match' | 'broadcast'>('database');
  const [theme, setTheme] = useState<ThemeMode>('pink');
  const [config, setConfig] = useState<ApiConfig>(DEFAULT_CONFIG);
  const [profiles, setProfiles] = useState<ApiProfile[]>([]);
  const [profileName, setProfileName] = useState('');
  const [properties, setProperties] = useState<Property[]>([]);
  const [user, setUser] = useState<any>(null);
  const [authForm, setAuthForm] = useState({ username: '', password: '' });
  const [isAuthLoading, setIsAuthLoading] = useState(false);
  const [models, setModels] = useState<string[]>(['gemini-1.5-pro', 'gemini-1.5-flash', 'gemini-2.0-flash-exp', 'deepseek-chat', 'deepseek-coder', 'claude-3.5-sonnet', 'claude-3.5-haiku', 'gpt-4o', 'gpt-4o-mini']);
  const [isConfigSaved, setIsConfigSaved] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [isMatching, setIsMatching] = useState(false);
  const [isBroadcasting, setIsBroadcasting] = useState(false);
  const [isSuggesting, setIsSuggesting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [extractText, setExtractText] = useState('');
  const [extractImages, setExtractImages] = useState<string[]>([]);
  const [filterArea, setFilterArea] = useState<string>('全部');
  const [matchRequest, setMatchRequest] = useState('');
  const [matchMode, setMatchMode] = useState<'concise' | 'professional'>('concise');
  const [matchHistory, setMatchHistory] = useState<MatchMessage[]>([]);
  const [broadcastResult, setBroadcastResult] = useState('');
  const [broadcastMode, setBroadcastMode] = useState<'auto' | 'template'>('auto');
  const [broadcastTemplate, setBroadcastTemplate] = useState('');
  const [selectedPropIds, setSelectedPropIds] = useState<string[]>([]);
  const [editingProp, setEditingProp] = useState<Property | null>(null);

  const t = THEMES[theme];

  // --- Effects ---
  useEffect(() => {
    const savedConfig = localStorage.getItem(STORAGE_KEYS.CONFIG);
    if (savedConfig) setConfig(JSON.parse(savedConfig));

    const savedTheme = localStorage.getItem(STORAGE_KEYS.THEME) as ThemeMode;
    if (savedTheme && THEMES[savedTheme]) setTheme(savedTheme);

    const savedProfiles = localStorage.getItem('api_profiles');
    if (savedProfiles) setProfiles(JSON.parse(savedProfiles));

    // Auth Listener
    const unsubsAuth = onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (u) {
        // Sync User specific properties
        const q = query(collection(db, 'properties'), orderBy('createdAt', 'desc'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
          const props: Property[] = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          } as Property));
          setProperties(props);
        }, (err) => {
          setError(`Firebase 同步失败: ${err.message}`);
        });
        return () => unsubscribe();
      } else {
        setProperties([]);
      }
    });

    return () => {
      unsubsAuth();
    };
  }, []);

  useEffect(() => {
    localStorage.setItem('api_profiles', JSON.stringify(profiles));
  }, [profiles]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.THEME, theme);
  }, [theme]);

  // --- Actions ---

  const handleSaveConfig = () => {
    localStorage.setItem(STORAGE_KEYS.CONFIG, JSON.stringify(config));
    setIsConfigSaved(true);
    setTimeout(() => setIsConfigSaved(false), 2000);
    setError(null);
  };

  const handleAuth = async () => {
    if (!authForm.username || !authForm.password) {
      setError('请输入用户名和密码');
      return;
    }
    
    setIsAuthLoading(true);
    setError(null);
    const email = `${authForm.username}@house-expert.local`;
    
    try {
      try {
        await signInWithEmailAndPassword(auth, email, authForm.password);
      } catch (err: any) {
        if (err.code === 'auth/user-not-found' || err.code === 'auth/invalid-credential') {
          // Attempt simple creation logic
          await createUserWithEmailAndPassword(auth, email, authForm.password);
        } else {
          throw err;
        }
      }
    } catch (err: any) {
      setError(`登录/注册失败: ${err.message}`);
    } finally {
      setIsAuthLoading(false);
    }
  };

  const handleLogout = () => {
    signOut(auth);
  };

  const [addressSuggestions, setAddressSuggestions] = useState<any[]>([]);
  const [isSuggestionOpen, setIsSuggestionOpen] = useState(false);

  // AMap Autocomplete Implementation
  useEffect(() => {
    if (!editingProp || !editingProp.address || editingProp.address.length < 2) {
      setAddressSuggestions([]);
      setIsSuggestionOpen(false);
      return;
    }

    const timer = setTimeout(() => {
      if (window.AMap && window.AMap.Autocomplete) {
        const auto = new window.AMap.Autocomplete({
          city: '上海',
          citylimit: true
        });
        auto.search(editingProp.address, (status: string, result: any) => {
          if (status === 'complete' && result.tips) {
            setAddressSuggestions(result.tips.filter((t: any) => t.id));
            setIsSuggestionOpen(true);
          }
        });
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [editingProp?.address]);

  const downloadProjectBrief = (prop: Property) => {
    const content = `
【项目名称】：${prop.name}
【所属板块】：${prop.area}
【详细地址】：${prop.address || '暂无'}
【在售楼层】：${prop.saleFloor || '暂无'}
【在售面积】：${prop.saleArea || '暂无'}
【均价总价】：${prop.totalPrice}
【预计首付】：${prop.downPayment}
【当前状态】：${prop.status}
【户型规格】：${prop.layout}

【核心卖点】：
${prop.sellingPoints}

【配套设施】：
${prop.nearbyFacilities || '暂无'}

【项目简介】：
${prop.projectBrief || '暂无'}

【生成时间】：${new Date(prop.createdAt).toLocaleString()}
    `.trim();

    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${prop.name}_项目简报.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleSaveProfile = () => {
    if (!profileName.trim()) {
      setError('请输入配置名称');
      return;
    }
    const newProfile: ApiProfile = {
      id: Date.now().toString(),
      name: profileName,
      config: { ...config }
    };
    setProfiles(prev => [...prev, newProfile]);
    setProfileName('');
    setIsConfigSaved(true);
    setTimeout(() => setIsConfigSaved(false), 2000);
  };

  const handleDeleteProfile = (id: string) => {
    setProfiles(prev => prev.filter(p => p.id !== id));
  };

  const handleSelectProfile = (p: ApiProfile) => {
    setConfig(p.config);
  };

  const fetchModels = async () => {
    setError(null);
    try {
      const modelsUrl = config.url.replace('/chat/completions', '/models');
      const response = await fetch(modelsUrl, {
        headers: {
          'Authorization': `Bearer ${config.key}`
        }
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}: 获取模型失败`);
      const data = await response.json();
      const modelList = data.data.map((m: any) => m.id);
      setModels(modelList);
      if (modelList.length > 0 && !modelList.includes(config.model)) {
        setConfig(prev => ({ ...prev, model: modelList[0] }));
      }
    } catch (err: any) {
      setError(`拉取模型失败: ${err.message}. 请手动输入。`);
    }
  };

  const cleanJson = (text: string) => {
    return text
      .replace(/```json/gi, '')
      .replace(/```/gi, '')
      .trim();
  };

  const ensureString = (val: any): string => {
    if (typeof val === 'string') return val;
    if (val === null || val === undefined) return '';
    if (Array.isArray(val)) return val.join(', ');
    if (typeof val === 'object') {
      return Object.entries(val)
        .map(([k, v]) => `${k}: ${JSON.stringify(v)}`)
        .join('; ');
    }
    return String(val);
  };

  const aiExtract = async () => {
    if (!extractText.trim() && extractImages.length === 0) return;
    setIsExtracting(true);
    setError(null);

    try {
      const userContent: any[] = [];
      if (extractText.trim()) {
        userContent.push({ type: 'text', text: extractText });
      }
      if (extractImages.length > 0) {
        extractImages.forEach(img => {
          userContent.push({
            type: 'image_url',
            image_url: { url: img }
          });
        });
      }

      const response = await fetch(config.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.key}`
        },
        body: JSON.stringify({
          model: config.model,
          messages: [
            { 
              role: 'system', 
              content: '你是一个上海房地产智能分析专家。你的任务是从用户提供的文字或【多张图片】（如宣传海报、VR 截图、销售笔记等）中提取深度房源信息。必须输出纯 JSON 格式。字段包含：项目名、区域（必须是如“徐汇”、“闵行”等标准行政区）、地址（尽量提取详细门牌号）、总价（如“450万”）、总价数值（用于排序的纯数字）、首付、面积与户型、交房状态、核心卖点（提取最诱人的 2-3 点）、附近配套（交通、学校、商圈）、在售楼层（如“高区”、“12层”）、在售面积（如“89-120平”）、项目资料（如有详细推介文本请汇总）。即使信息零散，也请发挥逻辑推断能力进行整合。' 
            },
            { role: 'user', content: userContent }
          ]
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error?.message || `HTTP ${response.status}`);
      }

      const data = await response.json();
      const content = data.choices[0].message.content;
      const jsonStr = cleanJson(content);
      const extracted: ExtractionResult = JSON.parse(jsonStr);

      const propData = {
        name: ensureString(extracted.项目名),
        area: ensureString(extracted.区域),
        address: ensureString(extracted.地址),
        totalPrice: ensureString(extracted.总价),
        totalPriceValue: extracted.总价数值,
        downPayment: ensureString(extracted.首付),
        layout: ensureString(extracted.面积与户型),
        status: ensureString(extracted.交房状态),
        sellingPoints: ensureString(extracted.核心卖点),
        nearbyFacilities: ensureString(extracted.附近配套),
        saleFloor: ensureString(extracted.在售楼层),
        saleArea: ensureString(extracted.在售面积),
        projectBrief: ensureString(extracted.项目资料),
        createdAt: Date.now(),
        userId: auth.currentUser?.uid || 'anonymous'
      };

      await addDoc(collection(db, 'properties'), propData);

      setExtractText('');
      setExtractImages([]);
      setActiveTab('database');
    } catch (err: any) {
      setError(`AI 解析失败: ${err.message}`);
    } finally {
      setIsExtracting(false);
    }
  };

  const aiMatch = async (isContinue = false) => {
    if (!matchRequest.trim() || properties.length === 0) return;
    setIsMatching(true);
    setError(null);

    try {
      const modePrompt = matchMode === 'concise' 
        ? '请输出精简的项目对比方案（1.项目A：卖点；2.项目B：卖点...），字数控制在250字以内，禁止使用Markdown符号。'
        : '请生成一份专业的电销推荐话术，包含开场白、核心优势分析及邀约建议，禁止使用Markdown符号。';

      // Map properties to a slightly more focused object to handle context window better while ensuring key info is included
      const propertyContext = properties.map(p => ({
        项目: p.name,
        区域: p.area,
        地址: p.address,
        总价: p.totalPrice,
        户型: p.layout,
        在售楼层: p.saleFloor,
        在售面积: p.saleArea,
        核心卖点: p.sellingPoints,
        周边配套: p.nearbyFacilities,
        项目资料: p.projectBrief // Now including the detailed brief for AI to read
      }));

      const systemPrompt = `你是一个专业的房地产金牌顾问。请根据房源库提供匹配方案。
      要求：
      1. 请仔细分析房源的基本信息，并深度挖掘【项目资料】中的细节（如具体的装修标准、特殊的赠送空间、社区环境、开发商背景等）进行匹配。
      2. 一次筛选 1-3 个最符合的项目。
      3. 严禁使用 **、###、-、* 等 Markdown 符号。
      4. 结构清爽，使用纯换行组织。
      5. 当前回复模式：${modePrompt}
      
      房源库数据（请基于此进行深度推荐）：${JSON.stringify(propertyContext)}`;

      const currentMessages: MatchMessage[] = isContinue 
        ? [...matchHistory, { role: 'user', content: matchRequest }]
        : [{ role: 'user', content: matchRequest }];

      const response = await fetch(config.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.key}`
        },
        body: JSON.stringify({
          model: config.model,
          messages: [
            { role: 'system', content: systemPrompt },
            ...currentMessages
          ]
        })
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const data = await response.json();
      const content = data.choices[0].message.content.replace(/[#*`]/g, '').trim();
      
      const newHistory: MatchMessage[] = isContinue 
        ? [...currentMessages, { role: 'assistant', content }]
        : [{ role: 'user', content: matchRequest }, { role: 'assistant', content }];

      setMatchHistory(newHistory);
      setMatchRequest('');
    } catch (err: any) {
      setError(`方案生成失败: ${err.message}`);
    } finally {
      setIsMatching(false);
    }
  };

  const handleExtractImage = (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []) as File[];
    if (files.length === 0) return;
    
    if (extractImages.length + files.length > 18) {
      setError('单次最多选择 18 张图片');
      return;
    }

    const readers = files.map((file: File) => {
      return new Promise<string>((resolve, reject) => {
        if (file.size > 4 * 1024 * 1024) {
          reject(new Error(`${file.name} 超过 4MB`));
          return;
        }
        const reader = new FileReader();
        reader.onload = (event) => resolve(event.target?.result as string);
        reader.onerror = () => reject(new Error('读取失败'));
        reader.readAsDataURL(file);
      });
    });

    Promise.all(readers)
      .then(newImages => {
        setExtractImages(prev => [...prev, ...newImages]);
      })
      .catch(err => {
        setError(err.message);
      });
  };

  const handleFileUpload = (e: ChangeEvent<HTMLInputElement>, field: 'imageUrl' | 'videoUrl') => {
    const file = e.target.files?.[0] as File;
    if (!file || !editingProp) return;
    
    if (file.size > 2 * 1024 * 1024) {
      setError('文件超过 2MB，请压缩后再试');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      setEditingProp({ ...editingProp, [field]: event.target?.result as string });
    };
    reader.readAsDataURL(file);
  };

  const aiBroadcast = async () => {
    if (selectedPropIds.length === 0) return;
    setIsBroadcasting(true);
    setError(null);

    try {
      if (broadcastMode === 'template' && !broadcastTemplate.trim()) {
        setError('请先输入模版格式再生成');
        setIsBroadcasting(false);
        return;
      }
      const selectedProps = properties.filter(p => selectedPropIds.includes(p.id));
      
      let systemPrompt = '';
      if (broadcastMode === 'auto') {
        if (selectedPropIds.length === 1) {
          systemPrompt = `你是一个上海顶级豪宅经纪人，擅长在朋友圈发【捡漏爆款】消息。
          目标：为这【一个】房源生成极具视觉冲击力的短讯。
          要求：
          1. 第一行配合 Emoji 突出最强卖点（如：🔥送25平私人露台、🏠最后清盘、捡漏王炸）。
          2. 核心参数精简：区域、板块名称、通燃气/民水民电（如有）、房型得房率、原价与现价对比。
          3. 结尾话术：“您今天可以看一下房子吗？” 或 “手慢无，随时专车接送”。
          4. 风格：禁忌废话，排版要透气，多用 [庆祝][嘿哈][色] 等 Emoji。`;
        } else {
          systemPrompt = `你是一个房产社群管家。请将选中的【多个房源】整理成一份精品清盘清单。
          要求：
          1. 头部问候：简短自然（如：晚上好，整理一些内部高性价比房源，发您看看）。
          2. 房源排版：使用数字图标 1️⃣, 2️⃣... 每一个房源是一个独立块。
          3. 结构：项目名+板块、面积、总价、核心标签（如 ✅通燃气 ✅内环内）、交通信息（如地铁0距离）。
          4. 结尾总结：“需要资料请回复编号1-3🌈，或者随时看房，有专车接送”。
          5. 严禁 Markdown 粗体，保持纯文字+Emoji。`;
        }
      } else if (broadcastMode === 'template') {
        systemPrompt = `你是一个房地产自媒体运营专家。请根据用户提供的【模版】，将其中占位符（如 {项目名}, {总价}, {区域} 等）替换为选中房源的实际信息。
        用户模版：${broadcastTemplate}
        规则：
        1. 严格遵守模版格式。
        2. 如果有多个房源，请按模版格式重复生成。
        3. 严禁使用 Markdown 符号。`;
      }

      const response = await fetch(config.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.key}`
        },
        body: JSON.stringify({
          model: config.model,
          messages: [
            { 
              role: 'system', 
              content: systemPrompt
            },
            {
              role: 'user',
              content: `选中的房源数据：${JSON.stringify(selectedProps)}`
            }
          ]
        })
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      setBroadcastResult(data.choices[0].message.content.replace(/[#*`]/g, '').trim());
    } catch (err: any) {
      setError(`群发生成失败: ${err.message}`);
    } finally {
      setIsBroadcasting(false);
    }
  };

  const togglePropSelection = (id: string) => {
    setSelectedPropIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const deleteProperty = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'properties', id));
    } catch (err: any) {
      setError(`删除失败: ${err.message}`);
    }
  };

  const updateProperty = async (updated: Property) => {
    try {
      const { id, ...data } = updated;
      await updateDoc(doc(db, 'properties', id), data as any);
      setEditingProp(null);
    } catch (err: any) {
      setError(`更新失败: ${err.message}`);
    }
  };

  const suggestAmenities = async (prop: Property) => {
    if (!prop.address && !prop.name) return;
    setIsSuggesting(prop.id);
    try {
      const response = await fetch(config.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.key}`
        },
        body: JSON.stringify({
          model: config.model,
          messages: [
            { 
              role: 'system', 
              content: '你是一个上海房地产专家。根据给出的项目名和地址，列举其周边的配套设施（交通、教育、医疗、商业）。回复请简洁，总共不超过100字。' 
            },
            { role: 'user', content: `项目名：${prop.name}, 地址：${prop.address || '上海'}` }
          ]
        })
      });
      const data = await response.json();
      const amenities = data.choices[0].message.content;
      updateProperty({ ...prop, nearbyFacilities: amenities });
    } catch (err: any) {
      setError(`建议配套失败: ${err.message}`);
    } finally {
      setIsSuggesting(null);
    }
  };

  // --- Render Helpers ---

  const getStatusColor = (status: string) => {
    const s = status.toLowerCase();
    if (s.includes('热') || s.includes('好') || s.includes('在售')) return 'bg-emerald-500';
    if (s.includes('紧') || s.includes('不多')) return 'bg-amber-500';
    if (s.includes('清') || s.includes('售罄')) return 'bg-rose-500';
    return 'bg-slate-400';
  };

  if (!user) {
    return (
      <div className={`min-h-screen ${t.bg} flex items-center justify-center p-4`}>
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md bg-white rounded-[3rem] p-10 md:p-12 shadow-2xl border-4 border-white"
        >
          <div className="text-center space-y-4 mb-10">
            <div className={`w-20 h-20 mx-auto ${t.secondary} rounded-[2rem] flex items-center justify-center text-white shadow-2xl rotate-6`}>
              <Sparkles className="w-10 h-10" />
            </div>
            <div className="space-y-1">
              <h1 className="text-3xl font-serif font-black text-slate-800">沪公寓助手</h1>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">APARTMENT ASSISTANT</p>
            </div>
            <p className="text-slate-400 font-medium italic pt-4 px-4">输入用户名即可锁定您的云端房源</p>
          </div>

          {error && (
            <div className="mb-8 p-6 bg-rose-50 border-2 border-rose-100 rounded-3xl text-rose-500 text-xs font-bold leading-relaxed">
              <div className="flex items-center gap-2 mb-2">
                <X className="w-4 h-4" />
                <span>操作失败</span>
              </div>
              {error.includes('auth/operation-not-allowed') ? (
                <div className="space-y-3">
                  <p className="text-sm">云端同步未激活：</p>
                  <p className="opacity-80 italic">请在 Firebase 控制台的 "Authentication &rarr; Sign-in method" 中开启 "Email/Password" 登录方式。</p>
                  <a 
                    href="https://console.firebase.google.com/project/gen-lang-client-0844792406/authentication/providers" 
                    target="_blank" 
                    rel="noreferrer"
                    className="block p-3 bg-rose-500 text-white rounded-xl text-center font-black active:scale-95 transition-all shadow-lg"
                  >
                    前往开启密码登录
                  </a>
                  <p className="opacity-70 text-[10px] text-center">开启后返回并刷新本页即可使用。</p>
                </div>
              ) : error}
            </div>
          )}

          <div className="space-y-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">用户名（自定义）</label>
              <input 
                type="text"
                value={authForm.username}
                onChange={e => setAuthForm(prev => ({ ...prev, username: e.target.value }))}
                placeholder="我的专属小店"
                className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:outline-none focus:ring-4 focus:ring-theme-primary/10 transition-all font-bold text-sm"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">进入密码</label>
              <input 
                type="password"
                value={authForm.password}
                onChange={e => setAuthForm(prev => ({ ...prev, password: e.target.value }))}
                placeholder="••••••••"
                className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:outline-none focus:ring-4 focus:ring-theme-primary/10 transition-all font-bold text-sm"
              />
            </div>
            <button 
              onClick={handleAuth}
              disabled={isAuthLoading}
              className={`w-full py-5 ${t.secondary} text-white rounded-[2rem] font-black text-lg shadow-2xl shadow-slate-200 hover:-translate-y-1 active:scale-95 transition-all flex items-center justify-center gap-3`}
            >
              {isAuthLoading ? <Loader2 className="animate-spin" /> : <ArrowRight />}
              开启私有空间
            </button>
          </div>
          
          <p className="mt-8 text-center text-[10px] text-slate-300 font-bold uppercase tracking-widest">
            Cloud Persistence Active
          </p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${t.gradient} text-slate-800 font-sans selection:bg-black/5 selection:text-slate-900 transition-colors duration-700`}>
      {/* Header */}
      <header className="bg-white/60 backdrop-blur-3xl sticky top-0 z-50 border-b border-white/40 px-6 py-4 shadow-sm">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className={`w-12 h-12 ${t.secondary} rounded-[1.5rem] flex items-center justify-center shadow-xl shadow-${theme}-200/40 transform hover:rotate-12 transition-all duration-500 cursor-pointer group`}>
              <Sparkles className="text-white w-6 h-6 group-hover:scale-125 transition-transform" />
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tight text-slate-900 font-serif leading-none italic uppercase">沪公寓助手</h1>
              <p className={`text-[10px] ${t.primary} font-black tracking-[0.2em] mt-1`}>APARTMENT ASSISTANT</p>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="flex flex-col items-end mr-4 hidden md:flex">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{user.email?.split('@')[0]}</span>
              <button onClick={handleLogout} className="text-[10px] font-black text-rose-500 uppercase tracking-widest hover:underline">退出登录</button>
            </div>
            <div className="flex bg-slate-100/50 p-1 rounded-full md:hidden">
            <button 
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className={`p-3 rounded-full transition-all ${isMobileMenuOpen ? `${t.secondary} text-white` : 'text-slate-500'}`}
            >
              {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>

          <nav className="hidden md:flex bg-white/50 backdrop-blur-md p-1.5 rounded-full border border-white/60 shadow-lg">
            {[
              { id: 'database', label: '房源管理', icon: Database },
              { id: 'input', label: 'AI 录入', icon: Plus },
              { id: 'match', label: '客户匹配', icon: Search },
              { id: 'broadcast', label: '群发助手', icon: Send },
              { id: 'config', label: '系统设置', icon: Settings }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`
                  flex items-center gap-2 px-6 py-2.5 rounded-2xl transition-all text-xs font-black uppercase tracking-widest
                  ${activeTab === tab.id 
                    ? `bg-white ${t.primary} shadow-xl scale-110 ring-4 ring-white/50` 
                    : 'text-slate-500 hover:text-slate-800 hover:bg-white/20'}
                `}
              >
                <tab.icon className="w-3.5 h-3.5" />
                {tab.label}
              </button>
            ))}
          </nav>
        </div>
      </div>
    </header>

      {/* Mobile Sidebar Menu */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMobileMenuOpen(false)}
              className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[60] md:hidden"
            />
            <motion.div 
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              className="fixed top-0 right-0 h-full w-3/4 bg-white z-[70] md:hidden shadow-2xl p-8 flex flex-col"
            >
              <div className="flex items-center justify-between mb-12">
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 ${t.secondary} rounded-lg flex items-center justify-center text-white`}>
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <div>
                    <h1 className="font-serif font-black text-slate-800 text-base leading-none">沪公寓助手</h1>
                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mt-1">APARTMENT ASSISTANT</p>
                  </div>
                </div>
                <button onClick={() => setIsMobileMenuOpen(false)}>
                  <X className="w-6 h-6 text-slate-400" />
                </button>
              </div>
              <div className="space-y-6">
                {[
                  { id: 'database', label: '房源管理', icon: Database },
                  { id: 'input', label: 'AI 录入', icon: Plus },
                  { id: 'match', label: '客户匹配', icon: Search },
                  { id: 'broadcast', label: '群发助手', icon: Send },
                  { id: 'config', label: '系统设置', icon: Settings }
                ].map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => {
                      setActiveTab(tab.id as any);
                      setIsMobileMenuOpen(false);
                    }}
                    className={`
                      w-full flex items-center gap-4 px-6 py-5 rounded-[2rem] transition-all text-sm font-black uppercase tracking-widest
                      ${activeTab === tab.id 
                        ? `${t.secondary} text-white shadow-xl` 
                        : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'}
                    `}
                  >
                    <tab.icon className="w-5 h-5" />
                    {tab.label}
                  </button>
                ))}
              </div>
              <div className="mt-auto pt-10 border-t border-slate-50">
                 <p className="text-[10px] text-slate-300 font-black uppercase tracking-widest text-center">Version 2.0 Cloud Sync</p>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <main className="max-w-6xl mx-auto p-4 md:p-10 pb-40 md:pb-10 relative overflow-hidden">
        {/* Error Alert */}
        <AnimatePresence>
          {error && (
            <motion.div 
              initial={{ opacity: 0, y: -40, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -40, scale: 0.9 }}
              className="mb-8 p-6 bg-white/80 backdrop-blur-xl border-4 border-rose-100 rounded-[2.5rem] flex items-start gap-4 text-rose-500 shadow-2xl z-40 relative"
            >
              <AlertCircle className="w-6 h-6 mt-0.5 flex-shrink-0" />
              <div className="flex-grow">
                <h4 className="font-bold mb-1">操作遇到了点问题</h4>
                <p className="text-sm opacity-80 leading-relaxed">{error}</p>
              </div>
              <button onClick={() => setError(null)} className="p-2 hover:bg-rose-100 rounded-xl transition-all">
                <Trash2 className="w-5 h-5" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* --- Content Modules --- */}
        <div className="space-y-12">
          
          {/* Module 1: Config Panel */}
          {activeTab === 'config' && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-white/80 backdrop-blur-sm rounded-[3rem] p-10 border border-white/50 shadow-2xl shadow-slate-200/50 overflow-hidden relative"
            >
              <div className="absolute top-0 right-0 p-12 opacity-5 pointer-events-none">
                 <Settings className="w-64 h-64 rotate-12" />
              </div>
              
              <div className="flex items-center gap-2 mb-10 relative">
                <Settings className={`${t.primary} w-7 h-7`} />
                <h2 className="text-3xl font-bold text-slate-900 font-serif">界面与设置</h2>
              </div>
              
              <div className="grid gap-10 relative">
                {/* Theme Selector */}
                <div className="space-y-5">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-[0.3em] ml-1">界面整体色相</label>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
                    {(Object.keys(THEMES) as ThemeMode[]).map(key => (
                      <button
                        key={key}
                        onClick={() => setTheme(key)}
                        className={`
                          p-5 rounded-3xl border-2 transition-all flex flex-col items-center gap-3 relative group
                          ${theme === key ? `border-slate-800 bg-white shadow-xl scale-105` : 'border-slate-100 bg-slate-50/50 hover:border-slate-200'}
                        `}
                      >
                        <div className={`w-12 h-12 rounded-2xl ${THEMES[key].secondary} shadow-lg shadow-${key}-200/50 transform group-hover:rotate-6 transition-transform`} />
                        <span className={`text-xs font-bold ${theme === key ? 'text-slate-900' : 'text-slate-400'}`}>{THEMES[key].label}</span>
                        {theme === key && <div className="absolute -top-2 -right-2 bg-slate-800 text-white rounded-full p-1"><CheckCircle2 className="w-3 h-3" /></div>}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="h-px bg-slate-100/60" />

                <div className="grid md:grid-cols-2 gap-8">
                  <div className="space-y-4">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">保存当前配置为偏好</label>
                    <div className="flex gap-3">
                      <input 
                        type="text" 
                        value={profileName}
                        onChange={e => setProfileName(e.target.value)}
                        placeholder="例如：双子座 API / 公司测试"
                        className="flex-grow px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:outline-none focus:ring-4 focus:ring-theme-primary/10 transition-all font-bold text-sm"
                      />
                      <button 
                        onClick={handleSaveProfile}
                        className={`px-8 ${t.secondary} text-white rounded-2xl font-black text-xs shadow-lg hover:scale-105 active:scale-95 transition-all whitespace-nowrap`}
                      >
                        保存配置
                      </button>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">已保存配置偏好</label>
                    <div className="flex flex-wrap gap-3">
                      {profiles.length === 0 ? (
                        <span className="text-xs text-slate-300 italic py-4">暂无保存的配置</span>
                      ) : (
                        profiles.map(p => (
                          <div 
                            key={p.id}
                            className={`
                              group flex items-center gap-2 pl-4 pr-2 py-2 rounded-xl border-2 transition-all
                              ${config.url === p.config.url && config.key === p.config.key ? `${t.secondary} border-transparent text-white shadow-xl` : 'bg-white border-slate-100 text-slate-500 hover:border-slate-200'}
                            `}
                          >
                            <button 
                              onClick={() => handleSelectProfile(p)}
                              className="text-xs font-black whitespace-nowrap"
                            >
                              {p.name}
                            </button>
                            <button 
                              onClick={() => handleDeleteProfile(p.id)}
                              className={`p-1.5 rounded-lg ${config.url === p.config.url && config.key === p.config.key ? 'bg-white/20' : 'bg-slate-50 text-slate-300 hover:text-rose-500'}`}
                            >
                              <Plus className="w-3 h-3 rotate-45" />
                            </button>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>

                <div className="h-px bg-slate-100/60" />

                <div className="grid md:grid-cols-2 gap-8">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between ml-1">
                      <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">API 终端</label>
                    </div>
                    <input 
                      type="text" 
                      value={config.url}
                      onChange={e => setConfig(prev => ({ ...prev, url: e.target.value }))}
                      placeholder="OpenAI 兼容接口地址 (含 /chat/completions)"
                      className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:outline-none focus:ring-4 focus:ring-theme-primary/10 transition-all font-mono text-sm leading-relaxed"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Access Key</label>
                    <input 
                      type="password" 
                      value={config.key}
                      onChange={e => setConfig(prev => ({ ...prev, key: e.target.value }))}
                      placeholder="sk-xxxxxxxxxxxxxxxx"
                      className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:outline-none focus:ring-4 focus:ring-theme-primary/10 transition-all font-mono text-sm"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">大语言模型</label>
                    <div className="flex gap-3">
                      <div className="relative flex-grow">
                        <input 
                          type="text" 
                          list="models-list"
                          value={config.model}
                          onChange={e => setConfig(prev => ({ ...prev, model: e.target.value }))}
                          placeholder="选择或手动指定模型"
                          className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:outline-none focus:ring-4 focus:ring-theme-primary/10 transition-all font-mono text-sm shadow-inner"
                        />
                        <datalist id="models-list">
                          {models.map(m => <option key={m} value={m} />)}
                        </datalist>
                      </div>
                      <button 
                        onClick={fetchModels}
                        className={`px-6 bg-white border border-slate-200 ${t.primary} rounded-2xl hover:bg-slate-50 active:scale-95 transition-all text-xs font-black flex items-center gap-2 whitespace-nowrap shadow-sm`}
                      >
                        <ChevronDown className="w-4 h-4" />
                        同步源
                      </button>
                    </div>
                  </div>
                </div>

                <div className="pt-6 flex flex-col md:flex-row items-center justify-between gap-6 border-t border-slate-50">
                  <div className="space-y-1 text-center md:text-left">
                    <p className="text-xs text-slate-400 font-medium italic">房源数据已同步至 Firebase 云端，API 密钥保留在本地。</p>
                    <p className="text-[10px] text-slate-300">如果提示 Auth 错误，请确保在 Firebase 控制台已开启匿名登录。</p>
                  </div>
                  <button 
                    onClick={handleSaveConfig}
                    className={`
                      w-full md:w-auto px-12 py-5 rounded-3xl font-black text-lg flex items-center justify-center gap-3 transition-all shadow-2xl
                      ${isConfigSaved 
                        ? 'bg-emerald-500 text-white shadow-emerald-200' 
                        : `${t.secondary} text-white shadow-slate-200 hover:-translate-y-1 active:translate-y-0`}
                    `}
                  >
                    {isConfigSaved ? (
                      <><CheckCircle2 className="w-6 h-6" /> 设置已更新</>
                    ) : (
                      '保存偏好设置'
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {/* Module 2: AI Input */}
          {activeTab === 'input' && (
            <motion.div 
               initial={{ opacity: 0, scale: 0.98 }}
               animate={{ opacity: 1, scale: 1 }}
               className="bg-white/90 backdrop-blur-sm rounded-[3.5rem] p-12 border border-white shadow-2xl shadow-slate-200/50 relative overflow-hidden"
            >
              <div className="absolute -bottom-20 -left-20 p-12 opacity-5 pointer-events-none">
                 <Sparkles className="w-96 h-96" />
              </div>

                <div className="flex flex-col items-center text-center gap-3 mb-10 relative">
                <div className={`w-16 h-16 ${t.secondary} rounded-full flex items-center justify-center text-white shadow-xl mb-2 ring-8 ring-white/50`}>
                   <Sparkles className="w-8 h-8" />
                </div>
                <h2 className="text-3xl font-black text-slate-800 font-serif tracking-tight">智能信息识别</h2>
                <p className="text-slate-400 text-sm max-w-md font-medium leading-relaxed">
                   粘贴销售笔记或群消息，甚至上传多张推介图片，AI 将自动分析并录入房源库。
                </p>
              </div>

              <div className="space-y-8 relative">
                <div className="group relative">
                  <textarea 
                    value={extractText}
                    onChange={e => setExtractText(e.target.value)}
                    placeholder="例如：\n【项目名】xx公馆，外环外，500w起，精装交付\n配套有地铁11号线，自带2w方商业...\n本月还有特价房..."
                    className="w-full h-80 px-8 py-8 bg-slate-50/70 border-2 border-slate-100 rounded-[2.5rem] focus:outline-none focus:border-slate-800 transition-all text-slate-800 resize-none font-medium text-xl leading-relaxed shadow-inner placeholder:text-slate-300"
                  />
                  {!extractText && extractImages.length === 0 && (
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none opacity-20 hidden md:block group-hover:scale-110 transition-transform">
                      <ClipboardList className={`w-32 h-32 ${t.primary}`} />
                    </div>
                  )}
                  {extractImages.length > 0 && (
                    <div className="mt-8 grid grid-cols-3 md:grid-cols-6 lg:grid-cols-9 gap-4">
                      {extractImages.map((img, idx) => (
                        <div key={idx} className="relative group/img aspect-square rounded-2xl overflow-hidden border-2 border-white shadow-lg">
                          <img src={img} className="w-full h-full object-cover" />
                          <button 
                             onClick={() => setExtractImages(prev => prev.filter((_, i) => i !== idx))}
                             className="absolute top-1 right-1 bg-rose-500 text-white p-1 rounded-full shadow-lg opacity-0 group-hover/img:opacity-100 transition-opacity"
                          >
                             <X className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                      {extractImages.length < 18 && (
                        <label className="aspect-square rounded-2xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center cursor-pointer hover:bg-slate-50 transition-all group/add">
                           <Plus className="w-6 h-6 text-slate-300 group-hover/add:text-slate-400" />
                           <input type="file" accept="image/*" multiple className="hidden" onChange={handleExtractImage} />
                        </label>
                      )}
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap items-center justify-center gap-4 md:gap-6">
                  <label className={`cursor-pointer flex items-center gap-3 px-6 md:px-8 py-5 md:py-6 bg-white border-2 border-slate-100 rounded-3xl md:rounded-[2rem] text-slate-800 font-black shadow-xl hover:-translate-y-1 transition-all active:scale-95 text-sm md:text-base`}>
                     <Camera className="w-5 h-5 md:w-6 md:h-6" />
                     {extractImages.length > 0 ? '添加图片' : '识别图片信息'}
                     <input type="file" accept="image/*" multiple className="hidden" onChange={handleExtractImage} />
                  </label>

                  <button 
                    onClick={aiExtract}
                    disabled={isExtracting || (!extractText.trim() && extractImages.length === 0)}
                    className={`group px-10 md:px-16 py-5 md:py-6 ${t.secondary} disabled:bg-slate-200 text-white rounded-3xl md:rounded-[2rem] font-black text-lg md:text-xl flex items-center gap-4 transition-all shadow-2xl shadow-slate-300 hover:-translate-y-1 active:translate-y-0`}
                  >
                    {isExtracting ? (
                      <Loader2 className="w-7 h-7 animate-spin" />
                    ) : (
                      <Send className="w-6 h-6 group-hover:translate-x-1 transition-transform" />
                    )}
                    {isExtracting ? '分析中...' : '提交录入'}
                  </button>
                  <div className="flex items-center gap-3 text-slate-400">
                     <CheckCircle2 className="w-4 h-4" />
                     <span className="text-xs font-bold uppercase tracking-widest text-[#FFB7C5]">支持自动提取配套与卖点</span>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* Module 3: Database */}
          {activeTab === 'database' && (
            <motion.div 
               initial={{ opacity: 0 }}
               animate={{ opacity: 1 }}
               className="space-y-8"
            >
              <div className="flex items-center justify-between px-6 bg-white py-6 rounded-[2rem] border border-slate-100 z-10 shadow-sm mb-10">
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 ${t.secondary} rounded-2xl flex items-center justify-center text-white shadow-lg`}>
                    <Database className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-black text-slate-900 font-serif leading-none">房源库房源</h2>
                    <p className="text-[10px] font-black text-slate-400 tracking-widest mt-2 opacity-70 uppercase">PROJECT REPOSITORY</p>
                  </div>
                  <span className="bg-slate-900 text-white text-[12px] px-4 py-1 rounded-full font-black ml-4 shadow-xl">
                    {properties.length}
                  </span>
                </div>
                <button 
                  onClick={() => {
                    setEditingProp({
                      id: '',
                      name: '',
                      area: '',
                      address: '',
                      totalPrice: '',
                      totalPriceValue: 0,
                      downPayment: '',
                      layout: '',
                      status: '待定',
                      sellingPoints: '',
                      nearbyFacilities: '',
                      saleFloor: '',
                      saleArea: '',
                      projectBrief: '',
                      imageUrl: '',
                      videoUrl: '',
                      createdAt: Date.now()
                    });
                  }}
                  className={`flex items-center gap-2 text-sm font-black ${t.primary} bg-white px-5 py-2.5 rounded-2xl shadow-sm hover:shadow-md transition-all border border-slate-50`}
                >
                  <Plus className="w-4 h-4" /> 录入房源
                </button>
              </div>

              {/* District Filter Slider */}
              <div className="flex items-center gap-3 overflow-x-auto pb-4 px-2 scrollbar-hide">
                {['全部', ...Array.from(new Set(properties.map(p => {
                   const district = p.area.replace(/区$/, '');
                   return district;
                })))].filter(Boolean).map(area => (
                  <button
                    key={area}
                    onClick={() => setFilterArea(area)}
                    className={`
                      px-8 py-3 rounded-2xl text-xs font-black transition-all whitespace-nowrap border-2
                      ${filterArea === area 
                        ? `${t.secondary} border-transparent text-white shadow-xl scale-105` 
                        : 'bg-white border-slate-50 text-slate-400 hover:border-slate-200'}
                    `}
                  >
                    {area}
                  </button>
                ))}
              </div>

              {properties.filter(p => filterArea === '全部' || p.area.includes(filterArea)).length === 0 ? (
                <div className="bg-white/40 backdrop-blur-sm rounded-[4rem] p-32 border-4 border-white border-dashed flex flex-col items-center justify-center text-center space-y-8">
                  <div className="w-32 h-32 bg-white rounded-[3rem] shadow-2xl flex items-center justify-center rotate-6">
                    <Database className="w-12 h-12 text-slate-100" />
                  </div>
                  <div className="space-y-3">
                    <h3 className="font-black text-3xl text-slate-300 font-serif italic">暂无房源记录</h3>
                    <p className="text-slate-300 font-bold max-w-sm mx-auto leading-relaxed uppercase tracking-tighter text-sm">请通过 AI 扫描录入您的房源信息。</p>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
                  {properties.filter(p => filterArea === '全部' || p.area.includes(filterArea)).map(prop => (
                    <motion.div 
                      layout
                      key={prop.id}
                      onClick={() => setEditingProp(prop)}
                      className={`group bg-white rounded-[2.5rem] border-2 transition-all p-6 relative overflow-hidden flex flex-col cursor-pointer hover:shadow-2xl hover:border-theme-primary/20 transition-all duration-300 ${selectedPropIds.includes(prop.id) ? `border-slate-800 ring-4 ring-slate-100 shadow-2xl` : 'border-white shadow-xl shadow-slate-200/40'}`}
                    >
                      {/* Selection Badge */}
                      <div className="absolute top-6 left-6 z-20">
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            togglePropSelection(prop.id);
                          }}
                          className={`w-7 h-7 rounded-full border-2 transition-all flex items-center justify-center ${
                            selectedPropIds.includes(prop.id) 
                            ? 'bg-slate-900 border-slate-900 text-white' 
                            : 'bg-white/80 backdrop-blur-md border-slate-200 hover:border-theme-primary'
                          }`}
                        >
                          {selectedPropIds.includes(prop.id) ? <Check className="w-4 h-4" /> : <div className="w-2 h-2 rounded-full bg-slate-200" />}
                        </button>
                      </div>

                      {/* Status pill */}
                      <div className="absolute top-6 right-6 z-10">
                         <div className={`px-3 py-1.5 rounded-full text-[9px] font-black tracking-widest text-white flex items-center gap-2 uppercase ${getStatusColor(prop.status)}`}>
                           <div className="w-1 h-1 bg-white rounded-full animate-pulse" />
                           {prop.status}
                         </div>
                      </div>

                      <div className="space-y-4 pt-10">
                         <div className="space-y-1">
                           <h3 className="font-black text-xl text-slate-800 group-hover:text-theme-primary transition-colors truncate">
                             {prop.name}
                           </h3>
                           <div className="flex items-center gap-1.5">
                             <MapPin className="w-3 h-3 text-slate-400" />
                             <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest truncate">{prop.area} · {prop.address?.split('区')?.[1]?.slice(0, 10) || '点击看详情'}</p>
                           </div>
                         </div>

                         {/* Mini Data Grid */}
                         <div className="grid grid-cols-2 gap-2">
                           <div className="bg-slate-50/80 p-3 rounded-2xl border border-slate-100 group-hover:bg-white transition-colors">
                             <p className="text-[8px] font-black text-slate-300 uppercase leading-none mb-1">价格/区间</p>
                             <p className="font-black text-theme-primary text-lg leading-none font-mono tracking-tighter">{prop.totalPrice}</p>
                           </div>
                           <div className="bg-slate-50/80 p-3 rounded-2xl border border-slate-100 group-hover:bg-white transition-colors">
                             <p className="text-[8px] font-black text-slate-300 uppercase leading-none mb-1">在售面积</p>
                             <p className="font-black text-slate-700 text-sm leading-none truncate">{prop.saleArea || '待核实'}</p>
                           </div>
                           <div className="bg-slate-50/80 p-3 rounded-2xl border border-slate-100 group-hover:bg-white transition-colors">
                             <p className="text-[8px] font-black text-slate-400 uppercase leading-none mb-1">楼层</p>
                             <p className="font-bold text-slate-600 text-[10px] truncate">{prop.saleFloor || '-'}</p>
                           </div>
                           <div className="bg-slate-50/80 p-3 rounded-2xl border border-slate-100 group-hover:bg-white transition-colors">
                             <p className="text-[8px] font-black text-slate-400 uppercase leading-none mb-1">户型规格</p>
                             <p className="font-bold text-slate-600 text-[10px] truncate">{prop.layout}</p>
                           </div>
                         </div>

                         {/* Selling Points Tag Cloud */}
                         <div className="flex flex-wrap gap-1.5 h-10 overflow-hidden">
                           {ensureString(prop.sellingPoints).split(/[,，、]/).slice(0, 3).map((tag, i) => (
                             <span key={i} className="text-[9px] px-2 py-1 bg-slate-100 text-slate-500 rounded-lg font-black border border-slate-200/30">
                               {tag.trim()}
                             </span>
                           ))}
                         </div>

                         {/* Action Indicators */}
                         <div className="flex items-center justify-between pt-2 border-t border-slate-50">
                            <div className="flex items-center gap-2">
                              {prop.projectBrief && <Database className="w-3.5 h-3.5 text-purple-400" />}
                              {prop.imageUrl && <Camera className="w-3.5 h-3.5 text-slate-300" />}
                            </div>
                            <button 
                             onClick={(e) => { e.stopPropagation(); downloadProjectBrief(prop); }}
                             className="text-[10px] font-black text-blue-500 hover:text-blue-700 flex items-center gap-1 transition-colors uppercase tracking-widest group/dl"
                           >
                             <Download className="w-3.5 h-3.5 group-hover/dl:-translate-y-0.5 transition-transform" />
                             资料
                           </button>
                         </div>
                      </div>
                    </motion.div>

                  ))}
                </div>
              )}
            </motion.div>
          )}

          {/* Module 4: Matching */}
          {activeTab === 'match' && (
            <motion.div 
               initial={{ opacity: 0, scale: 0.98 }}
               animate={{ opacity: 1, scale: 1 }}
               className="bg-white/95 backdrop-blur-md rounded-[3.5rem] p-10 md:p-14 border border-white shadow-2xl relative overflow-hidden flex flex-col min-h-[700px]"
            >
              <div className="absolute top-0 right-0 p-12 opacity-5 pointer-events-none">
                 <Search className="w-64 h-64 rotate-12" />
              </div>

              <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12 relative border-b border-slate-50 pb-8">
                <div>
                  <h2 className="text-4xl font-black text-slate-900 font-serif tracking-tight">智能客户方案</h2>
                  <p className="text-slate-400 text-[10px] font-black uppercase tracking-[0.4em] mt-2">AI PRECISION MATCHMAKING</p>
                </div>
                <div className="flex bg-slate-100 p-1.5 rounded-2xl">
                  <button 
                    onClick={() => setMatchMode('concise')}
                    className={`px-6 py-2.5 rounded-xl text-xs font-black transition-all ${matchMode === 'concise' ? 'bg-white shadow-lg text-slate-900 scale-105' : 'text-slate-400 hover:text-slate-600'}`}
                  >
                    精简筛选
                  </button>
                  <button 
                    onClick={() => setMatchMode('professional')}
                    className={`px-6 py-2.5 rounded-xl text-xs font-black transition-all ${matchMode === 'professional' ? 'bg-white shadow-lg text-slate-900 scale-105' : 'text-slate-400 hover:text-slate-600'}`}
                  >
                    电销话术
                  </button>
                </div>
              </div>

              <div className="flex-grow flex flex-col space-y-8 overflow-y-auto pr-4 scrollbar-hide max-h-[500px]">
                {matchHistory.length === 0 ? (
                  <div className="flex flex-col items-center justify-center text-center space-y-6 py-20 opacity-30">
                    <div className="w-24 h-24 bg-slate-50 rounded-full flex items-center justify-center">
                      <Search className="w-10 h-10" />
                    </div>
                    <p className="text-sm font-bold text-slate-400 uppercase tracking-widest leading-relaxed max-w-xs">
                      请输入客户需求，AI 将为您从 {properties.length} 个项目中智能筛选最佳方案。
                    </p>
                  </div>
                ) : (
                  matchHistory.map((msg, i) => (
                    <motion.div 
                      key={i}
                      initial={{ opacity: 0, x: msg.role === 'user' ? 20 : -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div className={`
                        max-w-[85%] px-8 py-6 rounded-[2.5rem] text-lg font-bold leading-relaxed shadow-sm
                        ${msg.role === 'user' 
                          ? `${t.secondary} text-white rounded-tr-none shadow-xl shadow-${theme}-200/40` 
                          : 'bg-slate-50 border border-slate-100 text-slate-800 rounded-tl-none'}
                      `}>
                        <p className="whitespace-pre-wrap">{msg.content}</p>
                      </div>
                    </motion.div>
                  ))
                )}
                {isMatching && (
                  <div className="flex justify-start">
                    <div className="bg-slate-50 px-8 py-6 rounded-[2.5rem] rounded-tl-none border border-slate-100 flex items-center gap-3">
                      <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
                      <span className="text-sm font-black text-slate-400 uppercase tracking-widest animate-pulse">专家演算中...</span>
                    </div>
                  </div>
                )}
              </div>

              <div className="mt-10 relative">
                <textarea 
                  value={matchRequest}
                  onChange={e => setMatchRequest(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      aiMatch(matchHistory.length > 0);
                    }
                  }}
                  placeholder={matchHistory.length > 0 ? "对此方案不满意？输入您的要求进行追问..." : "例如：预算 300-500 万，想要通燃气的，最好是在静安或者是虹口..."}
                  className="w-full px-10 py-8 bg-slate-50 border-2 border-slate-200 rounded-[2.5rem] focus:outline-none focus:border-slate-800 transition-all text-slate-800 resize-none font-medium text-xl leading-relaxed shadow-inner pr-32"
                />
                <button 
                  onClick={() => aiMatch(matchHistory.length > 0)}
                  disabled={isMatching || !matchRequest.trim()}
                  className={`absolute right-6 top-1/2 -translate-y-1/2 p-6 ${t.secondary} text-white rounded-3xl shadow-xl shadow-${theme}-200/50 hover:scale-105 active:scale-95 disabled:bg-slate-200 transition-all`}
                >
                  <Send className="w-6 h-6" />
                </button>
              </div>
              
              {matchHistory.length > 0 && (
                <button 
                  onClick={() => { setMatchHistory([]); setMatchRequest(''); }}
                  className="mt-6 text-[10px] font-black text-slate-300 hover:text-rose-400 uppercase tracking-widest transition-colors flex items-center justify-center gap-2"
                >
                  <Trash2 className="w-3.5 h-3.5" /> 重置对话历史
                </button>
              )}
            </motion.div>
          )}

          {activeTab === 'broadcast' && (
            <motion.div 
               initial={{ opacity: 0, scale: 0.98 }}
               animate={{ opacity: 1, scale: 1 }}
               className="bg-white/90 backdrop-blur-sm rounded-[3.5rem] p-12 border border-white shadow-2xl relative overflow-hidden"
            >
              <div className="flex flex-col md:flex-row items-center justify-between gap-6 mb-12 relative border-b border-slate-50 pb-8">
                <div className="flex items-center gap-4">
                  <div className={`w-14 h-14 ${t.secondary} rounded-2xl flex items-center justify-center text-white shadow-xl`}>
                    <Send className="w-7 h-7" />
                  </div>
                  <div>
                    <h2 className="text-3xl font-black text-slate-900 font-serif">群发助手</h2>
                    <p className="text-slate-400 text-[10px] font-black uppercase tracking-[0.4em]">Broadcast Assistant</p>
                  </div>
                </div>

                <div className="flex bg-slate-100 p-1.5 rounded-2xl">
                  {[
                    { id: 'auto', label: '自动生成' },
                    { id: 'template', label: '套用模板' }
                  ].map(mode => (
                    <button 
                      key={mode.id}
                      onClick={() => setBroadcastMode(mode.id as any)}
                      className={`px-6 py-2.5 rounded-xl text-xs font-black transition-all ${broadcastMode === mode.id ? 'bg-white shadow-lg text-slate-900 scale-105' : 'text-slate-400 hover:text-slate-600'}`}
                    >
                      {mode.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-12 items-start">
                <div className="space-y-8">
                  {broadcastMode === 'template' ? (
                    <div className="space-y-4">
                      <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-2">粘贴你的模版格式</label>
                      <textarea 
                        value={broadcastTemplate}
                        onChange={e => setBroadcastTemplate(e.target.value)}
                        placeholder="🔥清盘特价❗仅此一套❗\n🏠项目：{项目名}\n💰总价：{总价}\n...\nAI 将根据你的格式替换房源信息"
                        className="w-full h-64 px-8 py-6 bg-slate-50 border-2 border-slate-200 rounded-[2rem] focus:outline-none focus:border-slate-800 transition-all text-slate-800 resize-none font-medium leading-relaxed"
                      />
                    </div>
                  ) : (
                    <div className="bg-slate-50/50 p-8 rounded-[2.5rem] border border-slate-100">
                      <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-6 px-2 flex items-center justify-between">
                        待发出的房源
                        <span className="bg-slate-900 text-white px-2 py-0.5 rounded-md text-[10px]">{selectedPropIds.length}</span>
                      </h4>
                      <div className="space-y-3 max-h-[300px] overflow-y-auto scrollbar-hide">
                        {selectedPropIds.length === 0 ? (
                          <div className="py-12 flex flex-col items-center justify-center text-center space-y-4 opacity-30">
                             <Database className="w-10 h-10" />
                             <p className="text-xs font-bold uppercase">在房源管理中 Shift+点击 勾选房源</p>
                          </div>
                        ) : (
                          properties.filter(p => selectedPropIds.includes(p.id)).map(p => (
                            <div key={p.id} className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm flex items-center justify-between group">
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-lg overflow-hidden bg-slate-100 flex-shrink-0">
                                  {p.imageUrl ? <img src={p.imageUrl} className="w-full h-full object-cover" /> : <Plus className="w-4 h-4 m-auto text-slate-300" />}
                                </div>
                                <span className="font-bold text-slate-800 text-sm">{p.name}</span>
                              </div>
                              <button 
                                onClick={() => togglePropSelection(p.id)}
                                className="p-2 text-rose-300 hover:bg-rose-50 rounded-lg"
                              >
                                <Plus className="w-4 h-4 rotate-45" />
                              </button>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  )}

                  <button 
                    onClick={aiBroadcast}
                    disabled={isBroadcasting || selectedPropIds.length === 0}
                    className={`w-full py-6 ${t.secondary} text-white rounded-3xl font-black text-xl shadow-2xl flex items-center justify-center gap-4 transition-all disabled:bg-slate-200 active:scale-95`}
                  >
                    {isBroadcasting ? <Loader2 className="w-7 h-7 animate-spin" /> : <Sparkles className="w-6 h-6" />}
                    {isBroadcasting ? '正在生成...' : '立即生成群发内容'}
                  </button>
                </div>

                <div className="space-y-6">
                  <div className="bg-white rounded-[3rem] p-10 border border-slate-100 shadow-xl min-h-[500px] relative overflow-hidden group">
                     {!broadcastResult && (
                       <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-12 opacity-10 pointer-events-none group-hover:scale-110 transition-transform">
                          <ClipboardList className="w-32 h-32 mb-6" />
                          <p className="text-sm font-bold uppercase tracking-[0.2em]">文案生成预览区</p>
                       </div>
                     )}
                     <div className="relative z-10 whitespace-pre-wrap text-slate-800 leading-relaxed font-bold text-lg">
                       {broadcastResult}
                     </div>
                     {broadcastResult && (
                        <button 
                          onClick={() => {
                            navigator.clipboard.writeText(broadcastResult);
                            alert('已复制到剪贴板！');
                          }}
                          className="absolute bottom-10 right-10 p-5 bg-slate-900 text-white rounded-2xl shadow-2xl hover:scale-110 active:scale-95 transition-all flex items-center gap-3"
                        >
                          <Send className="w-5 h-5" />
                          <span className="text-xs font-black uppercase tracking-widest">复制全文</span>
                        </button>
                     )}
                  </div>
                </div>
              </div>
            </motion.div>
          )}

        </div>
      </main>

      {/* Mobile Navigation (Floating Bottom Bar) */}
      <footer className="md:hidden fixed bottom-6 left-1/2 -translate-x-1/2 w-[92%] z-50">
        <nav className="bg-slate-900/95 backdrop-blur-2xl p-2 rounded-full border border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.3)] flex items-center justify-around">
          {[
            { id: 'database', icon: Database },
            { id: 'input', icon: Plus },
            { id: 'match', icon: Search },
            { id: 'broadcast', icon: Send }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`p-4 rounded-full transition-all relative ${activeTab === tab.id ? `${t.secondary} text-white shadow-xl` : 'text-slate-500 hover:text-slate-300'}`}
            >
              <tab.icon className="w-6 h-6" />
            </button>
          ))}
          <button 
            onClick={() => setActiveTab('config')}
            className={`p-4 rounded-full transition-all ${activeTab === 'config' ? `${t.secondary} text-white shadow-xl` : 'text-slate-500'}`}
          >
            <Settings className="w-6 h-6" />
          </button>
        </nav>
      </footer>

      {/* Edit Modal (Universal High-End Modal) */}
      <AnimatePresence>
        {editingProp && (
           <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 md:p-12">
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setEditingProp(null)}
                className="absolute inset-0 bg-slate-900/60 backdrop-blur-md"
              />
              <motion.div 
                 initial={{ opacity: 0, scale: 0.9, y: 50 }}
                 animate={{ opacity: 1, scale: 1, y: 0 }}
                 exit={{ opacity: 0, scale: 0.9, y: 50 }}
                 className="relative bg-white rounded-[4rem] w-full max-w-3xl max-h-[90vh] overflow-hidden shadow-2xl border border-white flex flex-col"
              >
                 <div className="flex items-center justify-between p-10 border-b border-slate-50 sticky top-0 bg-white/90 backdrop-blur-md z-20">
                    <div>
                        <h3 className="text-3xl font-black text-slate-900 font-serif">编辑房源明细</h3>
                        <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest mt-1">Refine Project Specifications</p>
                    </div>
                    <button onClick={() => setEditingProp(null)} className="p-3 hover:bg-slate-50 rounded-full transition-colors group">
                      <Plus className="w-8 h-8 rotate-45 text-slate-300 group-hover:text-slate-900 transition-colors" />
                    </button>
                 </div>

                 <div className="p-10 space-y-10 overflow-y-auto flex-grow scrollbar-hide">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                       <div className="space-y-3">
                         <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">项目全名</label>
                         <input 
                           value={editingProp.name}
                           onChange={e => setEditingProp({ ...editingProp, name: e.target.value })}
                           className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-3xl focus:ring-4 focus:ring-theme-primary/10 outline-none transition-all font-bold text-slate-800"
                         />
                       </div>
                       <div className="space-y-3">
                         <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">所属板块</label>
                         <input 
                           value={editingProp.area}
                           onChange={e => setEditingProp({ ...editingProp, area: e.target.value })}
                           className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-3xl focus:ring-4 focus:ring-theme-primary/10 outline-none transition-all font-bold text-slate-800"
                         />
                       </div>
                       <div className="col-span-full space-y-3">
                         <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">详细地理位置 (关联高德数据)</label>
                         <div className="relative group/addr">
                           <input 
                             value={editingProp.address || ''}
                             onChange={e => setEditingProp({ ...editingProp, address: e.target.value })}
                             onFocus={() => editingProp.address && setIsSuggestionOpen(true)}
                             onBlur={() => setTimeout(() => setIsSuggestionOpen(false), 200)}
                             placeholder="输入地址或 POI 名称，自动联想补全..."
                             className="w-full px-8 py-5 bg-slate-50 border-2 border-slate-100 rounded-[2rem] focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500/30 outline-none transition-all font-bold text-slate-800 text-lg shadow-sm"
                           />
                           <div className="absolute right-6 top-1/2 -translate-y-1/2">
                              <Search className="w-5 h-5 text-slate-300" />
                           </div>
                           
                           {/* Suggestions Dropdown */}
                           <AnimatePresence>
                              {isSuggestionOpen && addressSuggestions.length > 0 && (
                                <motion.div 
                                  initial={{ opacity: 0, y: 10 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  exit={{ opacity: 0, y: 10 }}
                                  className="absolute left-0 right-0 top-full mt-2 bg-white rounded-3xl shadow-2xl border border-slate-100 z-[110] max-h-72 overflow-y-auto overflow-x-hidden scrollbar-hide py-2"
                                >
                                  {addressSuggestions.map((tip, idx) => (
                                    <button
                                      key={idx}
                                      type="button"
                                      onClick={() => {
                                        setEditingProp({ 
                                          ...editingProp, 
                                          address: tip.district + tip.address + tip.name,
                                          area: tip.district.replace('上海市', '').split('区')[0] + '区'
                                        });
                                        setIsSuggestionOpen(false);
                                      }}
                                      className="w-full text-left px-6 py-4 hover:bg-slate-50 transition-colors flex flex-col border-b border-slate-50 last:border-0"
                                    >
                                      <span className="font-bold text-slate-800 text-sm truncate">{tip.name}</span>
                                      <span className="text-[10px] text-slate-400 font-medium truncate">{tip.district} {tip.address}</span>
                                    </button>
                                  ))}
                                </motion.div>
                              )}
                           </AnimatePresence>
                         </div>
                       </div>
                       <div className="grid grid-cols-2 gap-4 col-span-full">
                         <div className="space-y-3">
                           <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">在售楼层 (如: 12-25层)</label>
                           <input 
                             value={editingProp.saleFloor || ''}
                             onChange={e => setEditingProp({ ...editingProp, saleFloor: e.target.value })}
                             className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-3xl focus:ring-4 focus:ring-theme-primary/10 outline-none transition-all font-bold text-slate-800"
                           />
                         </div>
                         <div className="space-y-3">
                           <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">在售面积 (如: 89-130平)</label>
                           <input 
                             value={editingProp.saleArea || ''}
                             onChange={e => setEditingProp({ ...editingProp, saleArea: e.target.value })}
                             className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-3xl focus:ring-4 focus:ring-theme-primary/10 outline-none transition-all font-bold text-slate-800"
                           />
                         </div>
                       </div>
                       <div className="space-y-3">
                         <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">价格/区间描述</label>
                         <input 
                           value={editingProp.totalPrice}
                           onChange={e => setEditingProp({ ...editingProp, totalPrice: e.target.value })}
                           className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-3xl focus:ring-4 focus:ring-theme-primary/10 outline-none transition-all font-bold text-slate-800 font-mono"
                         />
                       </div>
                       <div className="space-y-3">
                         <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">预计首付</label>
                         <input 
                           value={editingProp.downPayment}
                           onChange={e => setEditingProp({ ...editingProp, downPayment: e.target.value })}
                           className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-3xl focus:ring-4 focus:ring-theme-primary/10 outline-none transition-all font-bold text-slate-800 font-mono"
                         />
                       </div>
                       <div className="space-y-3">
                         <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">当前去化状态</label>
                         <input 
                           value={editingProp.status}
                           onChange={e => setEditingProp({ ...editingProp, status: e.target.value })}
                           className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-3xl focus:ring-4 focus:ring-theme-primary/10 outline-none transition-all font-bold text-slate-800"
                         />
                       </div>
                       <div className="space-y-3">
                         <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">宣传大图</label>
                         <div className="flex gap-3">
                           <input 
                             value={editingProp.imageUrl || ''}
                             onChange={e => setEditingProp({ ...editingProp, imageUrl: e.target.value })}
                             placeholder="图片 URL"
                             className="flex-grow px-6 py-4 bg-slate-50 border border-slate-100 rounded-3xl focus:ring-4 focus:ring-theme-primary/10 outline-none transition-all font-bold text-slate-800"
                           />
                           <label className={`cursor-pointer px-6 flex items-center justify-center ${t.secondary} text-white rounded-3xl active:scale-95 transition-all shadow-lg`}>
                             <Plus className="w-5 h-5" />
                             <input type="file" accept="image/*" className="hidden" onChange={e => handleFileUpload(e, 'imageUrl')} />
                           </label>
                         </div>
                       </div>
                       <div className="space-y-3">
                         <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">视频内容</label>
                         <div className="flex gap-3">
                           <input 
                             value={editingProp.videoUrl || ''}
                             onChange={e => setEditingProp({ ...editingProp, videoUrl: e.target.value })}
                             placeholder="视频 URL"
                             className="flex-grow px-6 py-4 bg-slate-50 border border-slate-100 rounded-3xl focus:ring-4 focus:ring-theme-primary/10 outline-none transition-all font-bold text-slate-800"
                           />
                           <label className={`cursor-pointer px-6 flex items-center justify-center ${t.secondary} text-white rounded-3xl active:scale-95 transition-all shadow-lg`}>
                             <Plus className="w-5 h-5" />
                             <input type="file" accept="video/*" className="hidden" onChange={e => handleFileUpload(e, 'videoUrl')} />
                           </label>
                         </div>
                       </div>
                       <div className="col-span-full space-y-3">
                         <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">核心卖点提炼</label>
                         <textarea 
                           value={editingProp.sellingPoints}
                           onChange={e => setEditingProp({ ...editingProp, sellingPoints: e.target.value })}
                           className="w-full h-32 px-6 py-5 bg-slate-50 border border-slate-100 rounded-3xl focus:ring-4 focus:ring-theme-primary/10 outline-none transition-all resize-none font-bold text-slate-800 leading-relaxed"
                         />
                       </div>
                       <div className="col-span-full space-y-3">
                         <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">项目深度推介资料 (可将复制出的长文、图片列表粘贴于此)</label>
                         <textarea 
                           value={editingProp.projectBrief || ''}
                           onChange={e => setEditingProp({ ...editingProp, projectBrief: e.target.value })}
                           placeholder="项目详细介绍、楼盘参数、图片汇总描述等..."
                           className="w-full h-48 px-6 py-5 bg-slate-50 border border-slate-100 rounded-3xl focus:ring-4 focus:ring-theme-primary/10 outline-none transition-all resize-none font-bold text-slate-800 leading-relaxed"
                         />
                       </div>
                       <div className="col-span-full space-y-3">
                         <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">配套设施说明</label>
                         <textarea 
                           value={editingProp.nearbyFacilities || ''}
                           onChange={e => setEditingProp({ ...editingProp, nearbyFacilities: e.target.value })}
                           className="w-full h-32 px-6 py-5 bg-slate-50 border border-slate-100 rounded-3xl focus:ring-4 focus:ring-theme-primary/10 outline-none transition-all resize-none font-bold text-slate-800 leading-relaxed"
                         />
                       </div>
                    </div>
                 </div>

                 <div className="p-10 pt-0 flex gap-5">
                    <button 
                      onClick={() => updateProperty(editingProp)}
                      className={`flex-grow py-5 ${t.secondary} text-white rounded-[2rem] font-black text-xl shadow-2xl hover:opacity-90 active:scale-95 transition-all shadow-slate-200`}
                    >
                      保存并更新档案
                    </button>
                    <button 
                      onClick={() => setEditingProp(null)}
                      className="px-10 py-5 bg-slate-50 text-slate-400 rounded-[2rem] font-black text-lg hover:bg-slate-100 transition-all border border-slate-100"
                    >
                      舍弃更改
                    </button>
                 </div>
              </motion.div>
           </div>
        )}
      </AnimatePresence>
    </div>
  );
}
