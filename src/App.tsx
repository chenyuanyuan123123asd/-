/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback, ChangeEvent, useMemo } from 'react';
import { 
  Settings, 
  Database, 
  Sparkles, 
  Search, 
  Home,
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
  X,
  RefreshCw,
  Trash,
  Video,
  TrainFront,
  Image as ImageIcon,
  Type as TypeIcon,
  ChevronUp
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Cropper, { Point, Area } from 'react-easy-crop';
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

interface BriefBlock {
  id: string;
  type: 'text' | 'image' | 'video';
  content: string;
}

interface Property {
  id: string;
  name: string;
  area: string;
  address?: string;
  totalPrice: string;
  averagePrice?: string; // 均价
  totalPriceValue?: number; // Normalized price for sorting/matching
  layout: string;
  sellingPoints: string;
  nearbyFacilities?: string;
  saleFloor?: string; // 在售楼层
  saleArea?: string;  // 在售面积
  utilities?: string; // 水电煤价格
  hasGas?: boolean;   // 是否通煤气
  propertyFee?: string; // 物业费
  parking?: string;    // 停车位
  elevatorRatio?: string; // 梯户比
  transport?: string;   // 交通情况
  projectBrief?: string; // 项目资料
  projectImages?: string[]; // 项目资料图片
  videoUrl?: string; // 房源视频
  briefBlocks?: BriefBlock[]; // 新版：图文视频穿插资料
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
  均价?: string;
  总价数值?: number; 
  面积与户型: string;
  水电煤: string;
  是否通煤气: boolean;
  物业费: string;
  停车位: string;
  梯户比: string;
  交通情况: string;
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

interface BroadcastTemplate {
  id: string;
  name: string;
  content: string;
  createdAt: any;
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

const BROADCAST_STYLES = [
  { id: 'professional', label: '专业高端', desc: '资深经纪人风，沉稳得体', emoji: '🤵' },
  { id: 'warm', label: '亲和温度', desc: '社群官家风，温馨自然', emoji: '🏡' },
  { id: 'data', label: '数据价值', desc: '分析师视角，强调性价比', emoji: '📊' },
  { id: 'social', label: '自媒体爆款', desc: '吸睛排版，带节奏高手', emoji: '🔥' },
  { id: 'urgent', label: '紧急清盘', desc: '最后席位，制造稀缺感', emoji: '⌛' }
];

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  return new Error(JSON.stringify(errInfo));
}

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

  // Performance Optimization: Memoize the filtered properties list to prevent recalculation on every render
  const filteredProperties = useMemo(() => {
    return properties.filter(p => {
      if (filterArea === '全部') return true;
      const normalizedArea = p.area.replace(/区$/, '').replace(/新区$/, '');
      return normalizedArea === filterArea;
    });
  }, [properties, filterArea]);

  // Performance Optimization: Memoize the district list for the filter slider
  const districts = ['全部', '黄浦', '徐汇', '长宁', '静安', '普陀', '虹口', '杨浦', '闵行', '宝山', '嘉定', '浦东', '金山', '松江', '青浦', '奉贤', '崇明'];
  const [matchRequest, setMatchRequest] = useState('');
  const [matchMode, setMatchMode] = useState<'concise' | 'professional'>('concise');
  const [matchHistory, setMatchHistory] = useState<MatchMessage[]>([]);
  const [customBg, setCustomBg] = useState<string | null>(localStorage.getItem('sh_apt_helper_custom_bg'));
  
  // Image Crop State
  const [cropImage, setCropImage] = useState<string | null>(null);
  const [crop, setCrop] = useState<Point>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [aspect, setAspect] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [onCropDone, setOnCropDone] = useState<(dataUrl: string) => void>(() => () => {});
  const [broadcastResult, setBroadcastResult] = useState('');
  const [broadcastTemplates, setBroadcastTemplates] = useState<BroadcastTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [newTemplateName, setNewTemplateName] = useState('');
  const [isSavingTemplate, setIsSavingTemplate] = useState(false);
  const [broadcastTemplate, setBroadcastTemplate] = useState('');
  const [selectedPropIds, setSelectedPropIds] = useState<string[]>([]);
  const [editingProp, setEditingProp] = useState<Property | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const t = THEMES[theme];

  const saveTemplate = async () => {
    if (!newTemplateName.trim() || !broadcastTemplate.trim()) {
      setError('请输入模板名称和内容');
      return;
    }
    setIsSavingTemplate(true);
    try {
      await addDoc(collection(db, 'broadcastTemplates'), {
        name: newTemplateName,
        content: broadcastTemplate,
        userId: auth.currentUser?.uid,
        createdAt: serverTimestamp()
      });
      setNewTemplateName('');
      setError(null);
    } catch (err: any) {
      const error = handleFirestoreError(err, OperationType.WRITE, 'broadcastTemplates');
      setError(`模板保存失败: ${err.message}`);
    } finally {
      setIsSavingTemplate(false);
    }
  };

  const deleteTemplate = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await deleteDoc(doc(db, 'broadcastTemplates', id));
      if (selectedTemplateId === id) {
        setSelectedTemplateId(null);
        setBroadcastTemplate('');
      }
    } catch (err: any) {
      handleFirestoreError(err, OperationType.DELETE, `broadcastTemplates/${id}`);
      setError(`模板删除失败: ${err.message}`);
    }
  };

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
        const qProps = query(
          collection(db, 'properties'), 
          where('userId', '==', u.uid),
          orderBy('createdAt', 'desc')
        );
        const unsubProps = onSnapshot(qProps, (snapshot) => {
          const props: Property[] = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          } as Property));
          setProperties(props);
        }, (err) => {
          handleFirestoreError(err, OperationType.LIST, 'properties');
          setError(`房源同步失败: ${err.message}`);
        });

        // Sync Broadcast Templates
        const qBroad = query(
          collection(db, 'broadcastTemplates'), 
          where('userId', '==', u.uid),
          orderBy('createdAt', 'desc')
        );
        const unsubBroad = onSnapshot(qBroad, (snapshot) => {
          const broadList = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          })) as BroadcastTemplate[];
          setBroadcastTemplates(broadList);
        }, (err) => {
          handleFirestoreError(err, OperationType.LIST, 'broadcastTemplates');
          setError(`模板同步失败: ${err.message}`);
        });

        return () => {
          unsubProps();
          unsubBroad();
        };
      } else {
        setProperties([]);
        setBroadcastTemplates([]);
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
    // Generate a rich HTML visual brief focusing ONLY on the Project Brief section
    const transportHtml = prop.transport ? `
      <div style="margin-bottom: 30px; background: #eff6ff; padding: 25px; border-radius: 20px; border: 1px solid #dbeafe;">
        <h3 style="margin: 0 0 10px 0; font-size: 14px; color: #1d4ed8; text-transform: uppercase; letter-spacing: 0.1em; font-weight: 800;">交通出行情况</h3>
        <p style="margin: 0; color: #1e40af; font-weight: 600; line-height: 1.6;">${prop.transport}</p>
      </div>
    ` : '';

    const blocksHtml = (prop.briefBlocks || []).map(block => {
      if (block.type === 'text') {
        return `<div style="margin-bottom: 25px; font-size: 16px; color: #334155; white-space: pre-wrap; line-height: 1.8;">${block.content}</div>`;
      } else if (block.type === 'image') {
        return `<div style="margin-bottom: 25px;"><img src="${block.content}" style="width: 100%; border-radius: 16px; display: block; box-shadow: 0 10px 15px -3px rgb(0 0 0 / 0.1);" /></div>`;
      } else if (block.type === 'video') {
        return `<div style="margin-bottom: 25px; background: #000; border-radius: 16px; overflow: hidden;"><video src="${block.content}" controls style="width: 100%; display: block;"></video></div>`;
      }
      return '';
    }).join('');

    const legacyImagesHtml = (prop.projectImages || []).map(img => `
      <div style="break-inside: avoid; margin-bottom: 20px;">
        <img src="${img}" style="width: 100%; border-radius: 12px; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);" />
      </div>
    `).join('');

    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${prop.name} - 项目资料</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #f8fafc; color: #1e293b; line-height: 1.6; padding: 40px 20px; }
    .container { max-width: 750px; margin: 0 auto; background: white; border-radius: 40px; box-shadow: 0 25px 50px -12px rgb(0 0 0 / 0.12); overflow: hidden; }
    .header { background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); color: white; padding: 50px 40px; }
    .header h1 { margin: 0; font-size: 32px; font-weight: 900; letter-spacing: -0.025em; }
    .header p { margin: 10px 0 0; opacity: 0.6; font-size: 14px; font-weight: 600; letter-spacing: 0.05em; text-transform: uppercase; }
    .content { padding: 40px; }
    .footer { margin-top: 60px; text-align: center; font-size: 13px; color: #94a3b8; padding: 40px; border-top: 1px solid #f1f5f9; background: #fcfcfd; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>${prop.name}</h1>
      <p>Project Presentation & Dossier</p>
    </div>
    <div class="content">
      ${transportHtml}
      ${blocksHtml}
      ${legacyImagesHtml}
      ${prop.videoUrl ? `<video src="${prop.videoUrl}" controls style="width: 100%; border-radius: 16px; background: #000; margin-bottom: 30px;"></video>` : ''}
    </div>
    <div class="footer">
      文档生成于：${new Date().toLocaleString()} | 上海房地产智能管理系统
    </div>
  </div>
</body>
</html>
    `;

    const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${prop.name}_项目资料.html`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleDeleteProp = (id: string) => {
    setConfirmDeleteId(id);
  };

  const executeDelete = async () => {
    if (!confirmDeleteId) return;
    try {
      await deleteDoc(doc(db, 'properties', confirmDeleteId));
      if (selectedPropIds.includes(confirmDeleteId)) {
        setSelectedPropIds(prev => prev.filter(sid => sid !== confirmDeleteId));
      }
      if (editingProp?.id === confirmDeleteId) {
        setEditingProp(null);
      }
      setConfirmDeleteId(null);
    } catch (err: any) {
      handleFirestoreError(err, OperationType.DELETE, `properties/${confirmDeleteId}`);
      setError(`删除失败: ${err.message}`);
    }
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
    try {
      // 1. Try to find standard JSON blocks first
      const jsonBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      if (jsonBlockMatch && jsonBlockMatch[1]) {
        return jsonBlockMatch[1].trim();
      }

      // 2. Fallback: Find the first '{' and the last '}'
      const firstBrace = text.indexOf('{');
      const lastBrace = text.lastIndexOf('}');
      if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
        return text.substring(firstBrace, lastBrace + 1).trim();
      }

      return text.trim();
    } catch (e) {
      return text.trim();
    }
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

  const addBlock = (type: 'text' | 'image' | 'video') => {
    if (!editingProp) return;
    const newBlock: BriefBlock = {
      id: Math.random().toString(36).substr(2, 9),
      type,
      content: ''
    };
    const blocks = [...(editingProp.briefBlocks || []), newBlock];
    setEditingProp({ ...editingProp, briefBlocks: blocks });
  };

  const updateBlock = (id: string, content: string) => {
    if (!editingProp) return;
    const blocks = (editingProp.briefBlocks || []).map(b => 
      b.id === id ? { ...b, content } : b
    );
    setEditingProp({ ...editingProp, briefBlocks: blocks });
  };

  const removeBlock = (id: string) => {
    if (!editingProp) return;
    const blocks = (editingProp.briefBlocks || []).filter(b => b.id !== id);
    setEditingProp({ ...editingProp, briefBlocks: blocks });
  };

  const moveBlock = (id: string, direction: 'up' | 'down') => {
    if (!editingProp || !editingProp.briefBlocks) return;
    const idx = editingProp.briefBlocks.findIndex(b => b.id === id);
    if (idx < 0) return;
    const newBlocks = [...editingProp.briefBlocks];
    if (direction === 'up' && idx > 0) {
      [newBlocks[idx-1], newBlocks[idx]] = [newBlocks[idx], newBlocks[idx-1]];
    } else if (direction === 'down' && idx < newBlocks.length - 1) {
      [newBlocks[idx], newBlocks[idx+1]] = [newBlocks[idx+1], newBlocks[idx]];
    }
    setEditingProp({ ...editingProp, briefBlocks: newBlocks });
  };

  const handleBlockImageUpload = async (e: ChangeEvent<HTMLInputElement>, blockId: string) => {
    const files = e.target.files;
    if (!files || !files[0]) return;
    const file = files[0];
    if (file.size > 8 * 1024 * 1024) {
      setError('图片大小不能超过 8MB');
      return;
    }
    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result) {
        updateBlock(blockId, event.target.result as string);
      }
    };
    reader.readAsDataURL(file);
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
              content: '你是一个上海房地产智能分析专家。你的任务是从用户提供的文字或【多张图片】中提取常规房源信息。严禁输出任何解释性文字，必须仅输出纯 JSON 格式。项目名必须【仅限中文】，绝对禁止包含任何英文单词、全称、缩写或英文字母（如：ANDI HOUSE 应提取为 安邸）。区域字段必须从以下 16 个区中选择一个（不要带“区”或“新区”字样）：黄浦、徐汇、长宁、静安、普陀、虹口、杨浦、闵行、宝山、嘉定、浦东、金山、松江、青浦、奉贤、崇明。例如“浦东新区”请提取为“浦东”。字段包含：项目名、区域、地址、总价（指该项目的起步总价或范围，如 100万起）、均价（指单价，如 50000/平）、总价数值（用于排序的数字）、面积与户型、水电煤、是否通煤气（布尔值）、物业费、停车位、梯户比、交通情况、核心卖点、附近配套、在售楼层、在售面积。关于交通情况：请务必详细提取离每个地铁站的距离，只要地铁站，地铁不方便的加公交站，如果资料里没有写地铁站，你必须根据项目地址自动确认距离。最后，将所有其他零散的卖点或补充说明总结到“项目资料”字段中。' 
            },
            { role: 'user', content: userContent }
          ],
          // Use json_object format for supported models
          ...( (config.model.includes('gpt-4') || config.model.includes('gemini') || config.model.includes('deepseek')) ? { response_format: { type: 'json_object' } } : {} )
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

      const totalP = ensureString(extracted.总价);
      const avgP = ensureString(extracted.均价);
      
      const propData = {
        name: ensureString(extracted.项目名),
        area: ensureString(extracted.区域),
        address: ensureString(extracted.地址),
        totalPrice: totalP,
        averagePrice: avgP,
        totalPriceValue: extracted.总价数值,
        layout: ensureString(extracted.面积与户型),
        utilities: ensureString(extracted.水电煤),
        hasGas: Boolean(extracted.是否通煤气),
        propertyFee: ensureString(extracted.物业费),
        parking: ensureString(extracted.停车位),
        elevatorRatio: ensureString(extracted.梯户比),
        transport: ensureString(extracted.交通情况),
        sellingPoints: ensureString(extracted.核心卖点),
        nearbyFacilities: ensureString(extracted.附近配套),
        saleFloor: ensureString(extracted.在售楼层),
        saleArea: ensureString(extracted.在售面积),
        projectBrief: ensureString(extracted.项目资料),
        projectImages: [],
        briefBlocks: extracted.项目资料 ? [{ id: Math.random().toString(36).substr(2, 9), type: 'text', content: ensureString(extracted.项目资料) }] : [],
        createdAt: Date.now(),
        userId: auth.currentUser?.uid
      };

      if (!propData.userId) throw new Error('用户未登录，无法保存房源');

      await addDoc(collection(db, 'properties'), propData);

      setExtractText('');
      setExtractImages([]);
      setActiveTab('database');
    } catch (err: any) {
      const error = handleFirestoreError(err, OperationType.WRITE, 'properties');
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
      
      核心准则：
      1. 优先在用户指定的区域中寻找匹配房源。
      2. 如果指定区域内没有完美契合的项目，你【必须】跳出区域限制，在全上海范围内寻找更契合用户核心需求（如单价、总价、燃气、通勤）的替代方案。
      3. 在推荐跨区房源时，必须给出令人信服的理由。不要简单说“价格便宜”，要从客户角度出发，比如：虽然不在您最初选择的区，但该项目就在地铁口，直达您关注的商圈，通勤效率甚至更高；或者该项目的品质和周边配套远超同价位区域项目。
      4. 你的目标是为客户提供最优解，而不仅仅是刻板地执行筛选条件。要有温度、人性化，真正为客户着想。
      
      具体要求：
      1. 请仔细分析房源基本信息，挖掘【项目资料】中的细节。
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
    
    if (extractImages.length + files.length > 20) {
      setError('单次最多选择 20 张图片');
      return;
    }

    const processImage = (file: File): Promise<string> => {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (event) => {
          const img = new Image();
          img.src = event.target?.result as string;
          img.onload = () => {
            const canvas = document.createElement('canvas');
            const MAX_WIDTH = 1280; // Slightly larger for better OCR
            const MAX_HEIGHT = 1280;
            let width = img.width;
            let height = img.height;

            if (width > height) {
              if (width > MAX_WIDTH) {
                height *= MAX_WIDTH / width;
                width = MAX_WIDTH;
              }
            } else {
              if (height > MAX_HEIGHT) {
                width *= MAX_HEIGHT / height;
                height = MAX_HEIGHT;
              }
            }
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            if (ctx) {
              ctx.imageSmoothingEnabled = true;
              ctx.imageSmoothingQuality = 'high';
              ctx.drawImage(img, 0, 0, width, height);
            }
            // Use 0.75 for a good balance of size and quality
            resolve(canvas.toDataURL('image/jpeg', 0.75));
          };
          img.onerror = () => reject(new Error('图片加载失败'));
        };
        reader.onerror = () => reject(new Error('读取失败'));
        reader.readAsDataURL(file);
      });
    };

    const processes = files.map((file: File) => processImage(file));

    Promise.all(processes)
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
    
    if (file.size > 8 * 1024 * 1024) {
      setError('文件超过 8MB');
      return;
    }

    const reader = new FileReader();
    reader.onload = async (event) => {
      const dataUrl = event.target?.result as string;
      if (field === 'imageUrl') {
        const compressedUrl = await compressImage(dataUrl, 400, 300); // Main image doesn't need to be huge
        setAspect(4/3); // Housing photo aspect ratio
        setCropImage(compressedUrl);
        setOnCropDone(() => async (croppedUrl: string) => {
          const finalUrl = await compressImage(croppedUrl, 400, 300);
          setEditingProp({ ...editingProp, [field]: finalUrl });
          setCropImage(null);
        });
      } else {
        setEditingProp({ ...editingProp, [field]: dataUrl });
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleBgUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) {
      setError('背景图片请不要超过 8MB');
      return;
    }
    const reader = new FileReader();
    reader.onload = async (event) => {
      const dataUrl = event.target?.result as string;
      const compressedUrl = await compressImage(dataUrl, 1200, 800);
      setAspect(window.innerWidth / window.innerHeight);
      setCropImage(compressedUrl);
      setOnCropDone(() => async (croppedUrl: string) => {
        const finalUrl = await compressImage(croppedUrl, 1200, 800);
        setCustomBg(finalUrl);
        localStorage.setItem('sh_apt_helper_custom_bg', finalUrl);
        setCropImage(null);
      });
    };
    reader.readAsDataURL(file);
    e.target.value = ''; // Reset for same file
  };

  const createImage = (url: string): Promise<HTMLImageElement> =>
    new Promise((resolve, reject) => {
      const image = new Image();
      image.addEventListener('load', () => resolve(image));
      image.addEventListener('error', (error) => reject(error));
      image.setAttribute('crossOrigin', 'anonymous');
      image.src = url;
    });

  const getCroppedImg = async (imageSrc: string, pixelCrop: Area): Promise<string> => {
    const image = await createImage(imageSrc);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    if (!ctx) return '';

    canvas.width = pixelCrop.width;
    canvas.height = pixelCrop.height;

    ctx.drawImage(
      image,
      pixelCrop.x,
      pixelCrop.y,
      pixelCrop.width,
      pixelCrop.height,
      0,
      0,
      pixelCrop.width,
      pixelCrop.height
    );

    return canvas.toDataURL('image/jpeg');
  };

  const handleApplyCrop = async () => {
    if (cropImage && croppedAreaPixels) {
      try {
        const croppedImage = await getCroppedImg(cropImage, croppedAreaPixels);
        onCropDone(croppedImage);
      } catch (e) {
        console.error(e);
      }
    }
  };

  const compressImage = async (dataUrl: string, maxWidth = 600, maxHeight = 600): Promise<string> => {
    return new Promise(async (resolve) => {
      const img = await createImage(dataUrl);
      let width = img.width;
      let height = img.height;

      if (width > height) {
        if (width > maxWidth) {
          height *= maxWidth / width;
          width = maxWidth;
        }
      } else {
        if (height > maxHeight) {
          width *= maxHeight / height;
          height = maxHeight;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx?.drawImage(img, 0, 0, width, height);
      // More aggressive compression for many images
      resolve(canvas.toDataURL('image/jpeg', 0.5));
    });
  };

  const calculateTotalSize = (images: string[]) => {
    return images.reduce((sum, img) => sum + img.length, 0);
  };

  const handleProjectImagesUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []) as File[];
    if (files.length === 0 || !editingProp) return;

    const currentImages = editingProp.projectImages || [];
    if (currentImages.length + files.length > 18) {
      setError('资料图片每套房源最多 18 张');
      return;
    }

    const readers = files.map((file: File) => {
      return new Promise<string>((resolve, reject) => {
        if (file.size > 8 * 1024 * 1024) { // Allow slightly larger original upload before compression
          reject(new Error(`${file.name} 超过 8MB`));
          return;
        }
        const reader = new FileReader();
        reader.onload = (event) => resolve(event.target?.result as string);
        reader.onerror = () => reject(new Error('读取失败'));
        reader.readAsDataURL(file);
      });
    });

    Promise.all(readers)
      .then(async (newImages) => {
        const compressedImages = await Promise.all(
          newImages.map(img => compressImage(img))
        );
        
        const nextImages = [...currentImages, ...compressedImages];
        const totalSize = calculateTotalSize(nextImages);
        
        // Firestore limit is ~1MB. We should stay well below it for safety.
        if (totalSize > 800 * 1024) {
          setError('房源总附件大小已接近云端存储限制，请分批或使用更小的图片');
          return;
        }

        setEditingProp({ 
          ...editingProp, 
          projectImages: nextImages 
        });
      })
      .catch(err => {
        setError(err.message);
      });
  };

  const aiBroadcast = async () => {
    if (selectedPropIds.length === 0) {
      setError('请先勾选需要生成的房源');
      return;
    }
    setIsBroadcasting(true);
    setError(null);

    try {
      const selectedProps = properties.filter(p => selectedPropIds.includes(p.id));
      
      let systemPrompt = '';
      if (broadcastTemplate.trim()) {
        systemPrompt = `你是一个房地产文案专家。请严格按照用户提供的【自定义内容/模板】进行生成或格式化。
        
        文案基础/模板：
        ${broadcastTemplate}
        
        要求：
        1. 如果是模板，将占位符（如 {项目名}, {总价}, {区域}, {单价}, {卖点} 等）替换为实际房源信息。
        2. 如果是参考文案，请参考其风格并带入房源信息。
        3. 区域名去掉“区”或“新区”后缀（如：浦东新区 -> 浦东）。
        4. 严禁使用任何 Markdown 符号（如 ** 或 #），保持纯文字+Emoji格式。`;
      } else {
        systemPrompt = `你是一个上海顶级房地产金牌顾问。请为选中的房源生成一段极具吸引力、非同质化的群发文案。
        
        核心准则：
        1. 【绝对去同质化】：拒绝公式化开场词，每次生成的文案结构都要有所变化。
        2. 【情感联结】：重点突出房源的“稀缺性”或“生活品质”，而不仅仅是罗列数据。
        3. 【呼吸感排版】：大量使用 Emoji [🔥][🏠][💰][🌈][🚀][✨][💎][📍][👑][💯]，保持文案紧凑有质感。
        4. 区域名简短化：必须去掉“区”或“新区”后缀。
        5. 严禁任何 Markdown 格式（如 ** 或 #），保持移动端易读性。
        6. 针对不同房源采用不同口吻（如：有的走专业分析，有的走紧急捡漏，有的走温馨居家）。`;
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
              content: `房源数据：${JSON.stringify(selectedProps.map(p => ({
                名称: p.name,
                区域: p.area,
                总价: p.totalPrice,
                单价: p.unitPrice,
                卖点: p.features
              })))}`
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
      handleFirestoreError(err, OperationType.DELETE, `properties/${id}`);
      setError(`删除失败: ${err.message}`);
    }
  };

  const updateProperty = async (updated: Property) => {
    try {
      const { id, ...data } = updated;
      await updateDoc(doc(db, 'properties', id), data as any);
      setEditingProp(null);
    } catch (err: any) {
      handleFirestoreError(err, OperationType.WRITE, `properties/${updated.id}`);
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
              <h1 className="text-3xl font-serif font-black text-slate-800">上海公寓小助手</h1>
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
    <div className="min-h-screen relative text-slate-800 font-sans selection:bg-black/5 selection:text-slate-900 transition-colors duration-700">
      {/* Fixed Background Layer to prevent jitters */}
      <div 
        className="fixed inset-0 z-[-1] pointer-events-none transition-all duration-700 bg-cover bg-center"
        style={customBg 
          ? { 
              backgroundImage: `linear-gradient(rgba(255,255,255,0.7), rgba(255,255,255,0.7)), url(${customBg})`
            } 
          : { backgroundColor: 'transparent' } 
        }
      />
      <div className={`min-h-screen ${customBg ? '' : t.gradient}`}>
        {/* Header */}
      <header className="bg-white/60 backdrop-blur-3xl sticky top-0 z-50 border-b border-white/40 px-6 py-4 shadow-sm">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className={`w-12 h-12 ${t.secondary} rounded-[1.5rem] flex items-center justify-center shadow-xl shadow-${theme}-200/40 transform hover:rotate-12 transition-all duration-500 cursor-pointer group`}>
              <Sparkles className="text-white w-6 h-6 group-hover:scale-125 transition-transform" />
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tight text-slate-900 font-serif leading-none italic uppercase">上海公寓小助手</h1>
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
                    <h1 className="font-serif font-black text-slate-800 text-base leading-none">上海公寓小助手</h1>
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
                <div className="space-y-8">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-[0.3em] ml-1">界面整体色相</label>
                    <div className="flex gap-4">
                      <label className="cursor-pointer text-[10px] font-black text-slate-400 hover:text-slate-600 flex items-center gap-2 bg-slate-100 px-4 py-2 rounded-full transition-all">
                        <Camera className="w-3 h-3" /> 自定义背景
                        <input type="file" accept="image/*" className="hidden" onChange={handleBgUpload} />
                      </label>
                      {customBg && (
                        <button 
                          onClick={() => { setCustomBg(null); localStorage.removeItem('sh_apt_helper_custom_bg'); }}
                          className="text-[10px] font-black text-rose-400 hover:text-rose-500 flex items-center gap-1"
                        >
                          <Trash2 className="w-3 h-3" /> 清除背景
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
                    {(Object.keys(THEMES) as ThemeMode[]).map(key => (
                      <button
                        key={key}
                        onClick={() => setTheme(key)}
                        className={`
                          p-5 rounded-3xl border-2 transition-all flex flex-col items-center gap-3 relative group overflow-visible
                          ${theme === key ? `border-slate-800 bg-white shadow-lg scale-105 z-10` : 'border-slate-100 bg-slate-50/50 hover:border-slate-200'}
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
                     {extractImages.length > 0 ? '添加图片' : '识别图片信息 (单张 ≤ 8MB)'}
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
                <motion.button 
                  whileTap={{ scale: 0.95 }}
                  whileHover={{ scale: 1.02 }}
                  onClick={() => {
                    setEditingProp({
                      id: '',
                      name: '',
                      area: '',
                      address: '',
                      totalPrice: '',
                      totalPriceValue: 0,
                      layout: '',
                      transport: '',
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
                </motion.button>
              </div>

              {/* District Filter Slider */}
              <div className="flex items-center gap-3 overflow-x-auto pb-10 pt-4 px-4 scrollbar-hide -mx-4">
                {districts.map(area => (
                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    key={area}
                    onClick={() => setFilterArea(area)}
                    className={`
                      px-8 py-3 rounded-2xl text-xs font-black transition-all whitespace-nowrap border-2
                      ${filterArea === area 
                        ? `${t.secondary} border-transparent text-white shadow-lg scale-105 z-10` 
                        : 'bg-white border-slate-50 text-slate-400 hover:border-slate-200'}
                    `}
                  >
                    {area}
                  </motion.button>
                ))}
              </div>

              {filteredProperties.length === 0 ? (
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
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                  {filteredProperties.map(prop => (
                    <motion.div 
                      layout="position"
                      whileHover={{ y: -4 }}
                      whileTap={{ scale: 0.98 }}
                      key={prop.id}
                      onClick={() => setEditingProp(prop)}
                      className={`group bg-white rounded-[2rem] border p-4 relative flex flex-col cursor-pointer overflow-hidden shadow-sm transition-[border-color,box-shadow,background-color] duration-300 hover:shadow-2xl hover:border-theme-primary/20 aspect-square ${selectedPropIds.includes(prop.id) ? `border-slate-800 ring-4 ring-slate-100 shadow-2xl` : 'border-slate-100'}`}
                    >
                      {/* Selection Badge */}
                      <div className="absolute top-2.5 left-2.5 z-20">
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedPropIds(prev => 
                              prev.includes(prop.id) 
                                ? prev.filter(sid => sid !== prop.id) 
                                : [...prev, prop.id]
                            );
                          }}
                          className={`w-5 h-5 rounded-full flex items-center justify-center border-2 transition-all ${selectedPropIds.includes(prop.id) ? 'bg-slate-900 border-slate-900 text-white scale-110' : 'bg-white/80 backdrop-blur-sm border-slate-200 text-transparent hover:border-slate-400'}`}
                        >
                          <Check className="w-3 h-3" />
                        </button>
                      </div>

                      {/* Delete Button */}
                      <div className="absolute top-3 right-3 z-20 opacity-0 group-hover:opacity-100 transition-opacity">
                         <button 
                           onClick={(e) => {
                             e.stopPropagation();
                             handleDeleteProp(prop.id);
                           }}
                           className="w-8 h-8 rounded-full bg-rose-50 text-rose-500 hover:bg-rose-500 hover:text-white transition-all flex items-center justify-center shadow-sm"
                         >
                           <Trash2 className="w-4 h-4" />
                         </button>
                      </div>

                      <div className="flex flex-col h-full justify-between pt-6">
                         <div className="space-y-1">
                           <h3 className="font-black text-sm text-slate-800 group-hover:text-theme-primary transition-colors line-clamp-2 leading-tight tracking-tight px-1">
                             {prop.name}
                           </h3>
                           <div className="flex items-center gap-1.5 px-1">
                             <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{prop.area.replace(/区$/, '')}</span>
                           </div>
                         </div>

                         <div className="space-y-1.5 mb-1">
                           <div className="bg-slate-50/50 p-2 rounded-xl border border-slate-100 group-hover:bg-white transition-colors">
                             <p className="font-black text-theme-primary text-base leading-none font-mono tracking-tighter truncate">
                               {prop.totalPrice || '暂无'}
                             </p>
                           </div>
                           
                           <div className="flex items-center justify-between px-1">
                              <span className="text-[8px] text-slate-400 font-bold uppercase tracking-widest">面积</span>
                              <span className="text-[11px] text-slate-700 font-black truncate">{prop.saleArea || '-'}</span>
                           </div>
                         </div>

                         {/* Footer indicators & Actions */}
                         <div className="flex items-center justify-between pt-2 border-t border-slate-50 mt-1">
                            <div className="flex gap-1 items-center">
                              {prop.videoUrl && <Video className="w-3 h-3 text-rose-500 animate-pulse" />}
                              {(prop.projectImages?.length || 0) > 0 && <Camera className="w-3 h-3 text-slate-300" />}
                              {prop.transport && <TrainFront className="w-3 h-3 text-blue-400" />}
                            </div>
                            <button 
                              onClick={(e) => { e.stopPropagation(); downloadProjectBrief(prop); }}
                              className="w-8 h-8 rounded-full bg-blue-50 text-blue-500 hover:bg-blue-500 hover:text-white transition-all flex items-center justify-center shadow-sm border border-blue-100"
                              title="下载房源资料"
                            >
                               <Download className="w-4 h-4" />
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

                <div className="flex items-center gap-2 px-6 py-2.5 bg-slate-50 rounded-xl border border-slate-100">
                  <Sparkles className={`w-4 h-4 ${t.primary}`} />
                  <span className="text-sm font-black text-slate-400 uppercase tracking-widest text-[10px]">AI 智能群发增强模式</span>
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-12 items-start">
                <div className="space-y-8">
                  {/* Property Summary (Top) */}
                  <div className="bg-slate-50/50 p-8 rounded-[2.5rem] border border-slate-100">
                    <div className="flex items-center justify-between mb-6 px-2">
                      <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                         <Home className="w-4 h-4" />
                         已选房源数据池
                      </h4>
                      <span className="bg-slate-900 text-white px-2.5 py-0.5 rounded-md text-[10px] font-black">{selectedPropIds.length}</span>
                    </div>
                    
                    <div className="space-y-3 max-h-[180px] overflow-y-auto scrollbar-hide pr-2">
                      {selectedPropIds.length === 0 ? (
                        <div className="py-10 flex flex-col items-center justify-center text-center space-y-3 opacity-20">
                           <Database className="w-10 h-10" />
                           <p className="text-[10px] font-black uppercase tracking-widest">请在房源管理中勾选房源</p>
                        </div>
                      ) : (
                        properties.filter(p => selectedPropIds.includes(p.id)).map(p => (
                          <div key={p.id} className="bg-white p-4 rounded-2xl border border-slate-100 flex items-center justify-between group transition-all hover:border-slate-200">
                            <div className="flex items-center gap-4">
                              <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-300">
                                {p.imageUrl ? (
                                  <img src={p.imageUrl} alt="" className="w-full h-full object-cover rounded-xl" />
                                ) : (
                                  <Home className="w-5 h-5" />
                                )}
                              </div>
                              <div>
                                <div className="font-black text-sm text-slate-800">{p.name}</div>
                                <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{p.area.replace(/[区|新区]$/, '')} · {p.totalPrice}</div>
                              </div>
                            </div>
                            <button 
                              onClick={() => setSelectedPropIds(prev => prev.filter(id => id !== p.id))}
                              className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-rose-50 text-slate-200 hover:text-rose-400 transition-all"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  <div className="space-y-6">
                    <div className="flex items-center justify-between px-2">
                        <label className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                          <ClipboardList className="w-4 h-4" />
                          云端格式模板
                        </label>
                        <button 
                          onClick={() => {
                            setSelectedTemplateId(null);
                            setBroadcastTemplate('');
                            setNewTemplateName('');
                          }}
                          className={`${t.primary} text-[10px] font-black uppercase tracking-widest hover:underline`}
                        >
                          + 新建空白模板
                        </button>
                      </div>

                      <div className="grid grid-cols-2 gap-3 max-h-[160px] overflow-y-auto pr-2 scrollbar-hide">
                        {broadcastTemplates.length > 0 ? (
                          broadcastTemplates.map(tpl => (
                            <div 
                              key={tpl.id}
                              onClick={() => {
                                setSelectedTemplateId(tpl.id);
                                setBroadcastTemplate(tpl.content);
                                setNewTemplateName(tpl.name);
                              }}
                              className={`p-4 rounded-[1.5rem] border-2 transition-all cursor-pointer relative group ${
                                selectedTemplateId === tpl.id 
                                  ? 'border-slate-900 bg-slate-900 text-white shadow-xl' 
                                  : 'border-slate-100 bg-white text-slate-600 hover:border-slate-200 shadow-sm'
                              }`}
                            >
                              <div className="font-black text-xs mb-1 truncate">{tpl.name}</div>
                              <div className="text-[10px] opacity-40 truncate leading-tight h-4">{tpl.content}</div>
                              <button 
                                onClick={(e) => deleteTemplate(tpl.id, e)}
                                className="absolute top-2 right-2 p-1.5 bg-rose-50 text-rose-400 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          ))
                        ) : (
                          <div className="col-span-2 py-8 border-2 border-dashed border-slate-100 rounded-[2rem] flex flex-col items-center justify-center opacity-40">
                             <span className="text-[10px] font-bold">暂无保存模板</span>
                          </div>
                        )}
                      </div>

                      <div className="space-y-4">
                        <div className="flex items-center justify-between px-2">
                          <label className="text-xs font-black text-slate-400 uppercase tracking-widest">
                            {selectedTemplateId ? '当前模板属性' : 'AI 自由发挥 / 参考内容'}
                          </label>
                          <div className="flex gap-2">
                            <input 
                              type="text"
                              value={newTemplateName}
                              onChange={e => setNewTemplateName(e.target.value)}
                              placeholder="模板名称"
                              className="w-24 px-3 py-1.5 text-[10px] border border-slate-200 rounded-xl focus:outline-none focus:border-slate-400 transition-all font-bold"
                            />
                            <button 
                              onClick={saveTemplate} 
                              disabled={isSavingTemplate || !broadcastTemplate.trim()}
                              className="bg-slate-900 text-white px-4 py-1.5 rounded-xl text-[10px] font-black hover:bg-slate-800 transition-all disabled:opacity-20 flex items-center gap-1.5"
                            >
                              {isSavingTemplate && <Loader2 className="w-3 h-3 animate-spin" />}
                              {selectedTemplateId ? '更新' : '保存'}
                            </button>
                          </div>
                        </div>
                        <textarea 
                          value={broadcastTemplate}
                          onChange={e => setBroadcastTemplate(e.target.value)}
                          placeholder="选择上方模板，或在此输入文案参考（使用 {项目名} 等占位符），留空则由 AI 自动生成..."
                          className="w-full h-40 px-6 py-5 bg-slate-50 border-2 border-slate-200 rounded-[2rem] focus:outline-none focus:border-slate-800 transition-all text-sm text-slate-800 font-medium leading-relaxed resize-none"
                        />
                        {!broadcastTemplate.trim() && (
                           <p className="text-[10px] text-slate-300 font-bold px-2 uppercase tracking-widest animate-pulse">✨ 当前模式：AI 灵感随机生成</p>
                        )}
                      </div>
                  </div>

                  <button 
                    onClick={aiBroadcast}
                    disabled={isBroadcasting || selectedPropIds.length === 0}
                    className={`w-full py-6 ${t.secondary} text-white rounded-[2rem] font-black text-xl shadow-2xl flex items-center justify-center gap-4 transition-all hover:scale-[1.02] active:scale-95 disabled:bg-slate-100 disabled:text-slate-300 disabled:scale-100`}
                  >
                    {isBroadcasting ? <Loader2 className="w-7 h-7 animate-spin" /> : <Sparkles className="w-6 h-6" />}
                    {isBroadcasting ? '正在编织文案...' : '生成独属群发内容'}
                  </button>
                </div>

                <div className="space-y-6">
                  <div className="bg-white rounded-[3.5rem] p-10 border border-slate-100 shadow-xl min-h-[500px] relative overflow-hidden group">
                     {!broadcastResult && (
                       <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-12 opacity-10 pointer-events-none group-hover:scale-110 transition-transform">
                          <div className="w-32 h-32 bg-slate-50 rounded-[3rem] mb-8 flex items-center justify-center">
                            <Send className="w-16 h-16" />
                          </div>
                          <p className="text-sm font-black uppercase tracking-[0.4em]">文案生成预览</p>
                          <p className="text-[10px] mt-4 opacity-50">GENERATION PREVIEW</p>
                       </div>
                     )}
                     <div className="relative z-10 whitespace-pre-wrap text-slate-800 leading-relaxed font-bold text-lg p-4">
                       {broadcastResult}
                     </div>
                     {broadcastResult && (
                        <div className="absolute bottom-10 right-10 flex gap-3">
                           <button 
                            onClick={() => {
                              navigator.clipboard.writeText(broadcastResult);
                              alert('已复制到剪贴板！');
                            }}
                            className="p-5 bg-slate-900 text-white rounded-3xl shadow-2xl hover:scale-110 active:scale-95 transition-all flex items-center gap-3 border-4 border-white"
                          >
                            <Send className="w-5 h-5" />
                            <span className="text-xs font-black uppercase tracking-widest">复制全文</span>
                          </button>
                        </div>
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
                         <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">水/电/煤</label>
                         <input 
                           value={editingProp.utilities || ''}
                           onChange={e => setEditingProp({ ...editingProp, utilities: e.target.value })}
                           placeholder="如：民用 0.61元/度"
                           className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-3xl focus:ring-4 focus:ring-theme-primary/10 outline-none transition-all font-bold text-slate-800"
                         />
                       </div>
                       <div className="space-y-3 flex flex-col">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">是否通煤气</label>
                          <button 
                            type="button"
                            onClick={() => setEditingProp({ ...editingProp, hasGas: !editingProp.hasGas })}
                            className={`mt-1 h-[58px] w-full rounded-3xl font-black text-sm transition-all flex items-center justify-center gap-2 ${editingProp.hasGas ? 'bg-orange-500 text-white shadow-xl shadow-orange-100' : 'bg-slate-100 text-slate-400'}`}
                          >
                            <div className={`w-2.5 h-2.5 rounded-full ${editingProp.hasGas ? 'bg-white animate-pulse' : 'bg-slate-300'}`} />
                            {editingProp.hasGas ? '通煤气' : '不通煤气'}
                          </button>
                       </div>
                       <div className="space-y-3">
                         <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">物业费</label>
                         <input 
                           value={editingProp.propertyFee || ''}
                           onChange={e => setEditingProp({ ...editingProp, propertyFee: e.target.value })}
                           placeholder="元/平/月"
                           className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-3xl focus:ring-4 focus:ring-theme-primary/10 outline-none transition-all font-bold text-slate-800"
                         />
                       </div>
                       <div className="space-y-3">
                         <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">房源停车月租</label>
                         <input 
                           value={editingProp.parking || ''}
                           onChange={e => setEditingProp({ ...editingProp, parking: e.target.value })}
                           placeholder="输入月租金额（元/月）"
                           className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-3xl focus:ring-4 focus:ring-theme-primary/10 outline-none transition-all font-bold text-slate-800"
                         />
                       </div>
                       <div className="space-y-3">
                         <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">梯户比</label>
                         <input 
                           value={editingProp.elevatorRatio || ''}
                           onChange={e => setEditingProp({ ...editingProp, elevatorRatio: e.target.value })}
                           placeholder="如：2梯4户"
                           className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-3xl focus:ring-4 focus:ring-theme-primary/10 outline-none transition-all font-bold text-slate-800"
                         />
                       </div>
                       <div className="col-span-full space-y-3">
                         <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">交通情况</label>
                         <textarea 
                           value={editingProp.transport || ''}
                           onChange={e => setEditingProp({ ...editingProp, transport: e.target.value })}
                           placeholder="如：离1号线人民广场站300米；地铁不便时可搭乘123路公交..."
                           className="w-full h-24 px-6 py-5 bg-slate-50 border border-slate-100 rounded-3xl focus:ring-4 focus:ring-theme-primary/10 outline-none transition-all resize-none font-bold text-slate-800 leading-relaxed"
                         />
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
                         <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">配套设施说明</label>
                         <textarea 
                           value={editingProp.nearbyFacilities || ''}
                           onChange={e => setEditingProp({ ...editingProp, nearbyFacilities: e.target.value })}
                           className="w-full h-32 px-6 py-5 bg-slate-50 border border-slate-100 rounded-3xl focus:ring-4 focus:ring-theme-primary/10 outline-none transition-all resize-none font-bold text-slate-800 leading-relaxed"
                         />
                       </div>
                       <div className="col-span-full space-y-6 pt-6 border-t border-slate-100">
                          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <div>
                               <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">项目深度推介资料 (图文穿插展示)</label>
                               <p className="text-[10px] text-slate-300 font-bold mt-1">支持文字段落与图片交替排列，导出更为精美</p>
                            </div>
                            <div className="flex gap-2">
                              <button 
                                onClick={() => addBlock('text')}
                                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-xs font-black transition-all flex items-center gap-2"
                              >
                                <TypeIcon className="w-3 h-3" />
                                添加文字
                              </button>
                              <label className="cursor-pointer px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-xl text-xs font-black transition-all flex items-center gap-2">
                                <ImageIcon className="w-3 h-3" />
                                插入图片
                                <input type="file" accept="image/*" className="hidden" onChange={async (e) => {
                                  const file = e.target.files?.[0];
                                  if (!file) return;
                                  const reader = new FileReader();
                                  reader.onload = (event) => {
                                    if (event.target?.result && editingProp) {
                                      const newBlock: BriefBlock = {
                                        id: Math.random().toString(36).substr(2, 9),
                                        type: 'image',
                                        content: event.target.result as string
                                      };
                                      const blocks = [...(editingProp.briefBlocks || []), newBlock];
                                      setEditingProp({ ...editingProp, briefBlocks: blocks });
                                    }
                                  };
                                  reader.readAsDataURL(file);
                                }} />
                              </label>
                            </div>
                          </div>

                          <div className="space-y-4">
                             {(editingProp.briefBlocks || []).length > 0 ? (
                               (editingProp.briefBlocks || []).map((block, bIdx) => (
                                 <motion.div 
                                   layout
                                   key={block.id} 
                                   className="relative group bg-slate-50/50 rounded-[2rem] p-6 border-2 border-slate-100/50"
                                 >
                                   <div className="absolute -left-12 top-1/2 -translate-y-1/2 flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-all">
                                      <button onClick={() => moveBlock(block.id, 'up')} className="p-2 bg-white shadow-md rounded-full text-slate-400 hover:text-blue-500"><ChevronUp className="w-4 h-4" /></button>
                                      <button onClick={() => moveBlock(block.id, 'down')} className="p-2 bg-white shadow-md rounded-full text-slate-400 hover:text-blue-500 rotate-180"><ChevronUp className="w-4 h-4" /></button>
                                   </div>

                                   <button 
                                     onClick={() => removeBlock(block.id)}
                                     className="absolute -right-3 -top-3 p-2 bg-rose-500 text-white rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-all z-10"
                                   >
                                     <X className="w-4 h-4" />
                                   </button>

                                   {block.type === 'text' ? (
                                     <textarea 
                                       value={block.content}
                                       onChange={(e) => updateBlock(block.id, e.target.value)}
                                       placeholder="输入该段落的介绍文字..."
                                       className="w-full min-h-[80px] bg-transparent outline-none resize-none font-bold text-slate-800 text-lg leading-relaxed placeholder:text-slate-300"
                                     />
                                   ) : (
                                     <div className="relative rounded-2xl overflow-hidden shadow-sm">
                                       <img src={block.content} className="w-full h-auto object-cover max-h-[400px]" />
                                     </div>
                                   )}
                                 </motion.div>
                               ))
                             ) : (
                               <div className="py-20 flex flex-col items-center justify-center text-center opacity-20 filter grayscale">
                                 <Database className="w-16 h-16 mb-4" />
                                 <p className="font-black">开始构建您的图文深度资料</p>
                               </div>
                             )}
                          </div>
                       </div>
                    </div>
                 </div>

                 <div className="p-10 pt-0 flex gap-5">
                    <motion.button 
                      whileTap={{ scale: 0.98 }}
                      whileHover={{ opacity: 0.9 }}
                      onClick={() => updateProperty(editingProp)}
                      className={`flex-grow py-5 ${t.secondary} text-white rounded-[2rem] font-black text-xl shadow-2xl transition-all shadow-slate-200`}
                    >
                      保存并更新档案
                    </motion.button>
                    <motion.button 
                      whileTap={{ scale: 0.98 }}
                      whileHover={{ backgroundColor: '#eff6ff' }}
                      onClick={() => downloadProjectBrief(editingProp)}
                      className="px-8 py-5 bg-blue-50 text-blue-500 rounded-[2rem] font-black text-lg transition-all border border-blue-100 flex items-center justify-center gap-2"
                    >
                      <Download className="w-5 h-5" />
                      下载资料
                    </motion.button>
                    <motion.button 
                      whileTap={{ scale: 0.98 }}
                      whileHover={{ backgroundColor: '#f1f5f9' }}
                      onClick={() => setEditingProp(null)}
                      className="px-10 py-5 bg-slate-50 text-slate-400 rounded-[2rem] font-black text-lg transition-all border border-slate-100"
                    >
                      取消
                    </motion.button>
                    <motion.button 
                      whileTap={{ scale: 0.9 }}
                      whileHover={{ backgroundColor: '#fef2f2', color: '#ef4444' }}
                      onClick={() => editingProp && handleDeleteProp(editingProp.id)}
                      className="p-5 border-2 border-red-50 text-red-100 rounded-[2rem] transition-all"
                      title="删除房源"
                    >
                      <Trash2 className="w-5 h-5" />
                    </motion.button>
                 </div>
              </motion.div>
           </div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {confirmDeleteId && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setConfirmDeleteId(null)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-md"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative bg-white rounded-[3rem] w-full max-w-sm p-10 shadow-2xl border-4 border-white flex flex-col items-center text-center"
            >
              <div className="w-20 h-20 bg-rose-50 rounded-[2rem] flex items-center justify-center text-rose-500 mb-6 shadow-inner">
                <Trash2 className="w-10 h-10" />
              </div>
              <h3 className="text-2xl font-black text-slate-900 font-serif mb-2">确认删除房源？</h3>
              <p className="text-slate-400 font-medium text-sm leading-relaxed mb-10">
                删除后该房源的所有数据将永久丢失，且无法找回。
              </p>
              <div className="grid grid-cols-2 gap-4 w-full">
                <button 
                  onClick={executeDelete}
                  className="py-4 bg-rose-500 text-white rounded-2xl font-black text-sm shadow-xl shadow-rose-200 hover:-translate-y-1 transition-all active:scale-95"
                >
                  确定删除
                </button>
                <button 
                  onClick={() => setConfirmDeleteId(null)}
                  className="py-4 bg-slate-50 text-slate-400 rounded-2xl font-black text-sm border border-slate-100 hover:bg-slate-100 transition-all active:scale-95"
                >
                  取消
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Crop Modal */}
      {cropImage && (
        <div className="fixed inset-0 z-[1000] bg-slate-900/90 backdrop-blur-2xl flex flex-col items-center justify-center p-6">
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-4xl bg-white rounded-[3rem] overflow-hidden shadow-2xl border-4 border-white flex flex-col"
          >
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-xl font-black text-slate-800 font-serif">图片裁剪与适配</h3>
              <button onClick={() => setCropImage(null)} className="p-3 hover:bg-slate-50 rounded-2xl transition-all">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="relative h-[50vh] bg-slate-100">
              <Cropper
                image={cropImage}
                crop={crop}
                zoom={zoom}
                aspect={aspect}
                onCropChange={setCrop}
                onCropComplete={(_, pixels) => setCroppedAreaPixels(pixels)}
                onZoomChange={setZoom}
              />
            </div>

            <div className="p-8 bg-slate-50/50 flex flex-col gap-6">
              <div className="flex items-center gap-4">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">缩放调整</span>
                <input 
                  type="range"
                  min={1}
                  max={3}
                  step={0.1}
                  value={zoom}
                  onChange={(e) => setZoom(Number(e.target.value))}
                  className="flex-grow h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-slate-800"
                />
              </div>

              <div className="flex gap-4">
                <button 
                  onClick={() => setCropImage(null)}
                  className="flex-1 py-5 bg-white text-slate-400 rounded-3xl font-black text-lg hover:bg-slate-100 transition-all border border-slate-100 shadow-sm"
                >
                  取消
                </button>
                <button 
                  onClick={handleApplyCrop}
                  className={`flex-1 py-5 ${t.secondary} text-white rounded-3xl font-black text-lg shadow-xl shadow-slate-100 hover:-translate-y-1 active:scale-95 transition-all`}
                >
                  确认选区并应用
                </button>
              </div>
            </div>
          </motion.div>
          <p className="mt-8 text-white/40 text-[10px] font-black tracking-[0.5em] uppercase animate-pulse">拖动图片调整位置 · 滚轮或滑块缩放</p>
        </div>
      )}
    </div>
  </div>
);
}
