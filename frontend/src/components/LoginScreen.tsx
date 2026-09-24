'use client';

import React, { useState, useEffect } from 'react';
import { UserPersona, UserRole } from '@/lib/types';
import { ShieldCheck, Building2, User, Lock, Mail, Briefcase, ArrowRight, Sparkles, CheckCircle2, ChevronDown, ChevronUp, UserPlus, LogIn, AlertCircle } from 'lucide-react';

const REGISTERED_USERS_KEY = 'rag_registered_users';

// Pre-seeded demo accounts
const DEFAULT_PRESET_USERS: (UserPersona & { password?: string })[] = [
  {
    id: 'aaaaaa11-1111-1111-1111-111111111111',
    name: 'Alice Admin',
    role: 'admin',
    designation: 'System Administrator',
    organizationId: '11111111-1111-1111-1111-111111111111',
    organizationName: 'Acme Corp',
    email: 'alice@acmecorp.com',
    password: 'password123'
  },
  {
    id: 'bbbbbb22-2222-2222-2222-222222222222',
    name: 'Bob Manager',
    role: 'manager',
    designation: 'Operations Manager',
    organizationId: '11111111-1111-1111-1111-111111111111',
    organizationName: 'Acme Corp',
    email: 'bob@acmecorp.com',
    password: 'password123'
  },
  {
    id: 'cccccc33-3333-3333-3333-333333333333',
    name: 'Charlie Member',
    role: 'member',
    designation: 'Software Engineer',
    organizationId: '11111111-1111-1111-1111-111111111111',
    organizationName: 'Acme Corp',
    email: 'charlie@acmecorp.com',
    password: 'password123'
  },
  {
    id: 'dddddd44-4444-4444-4444-444444444444',
    name: 'David Globex',
    role: 'admin',
    designation: 'Executive Admin',
    organizationId: '22222222-2222-2222-2222-222222222222',
    organizationName: 'Globex Inc',
    email: 'david@globex.com',
    password: 'password123'
  }
];

function generateOrgId(orgName: string): string {
  const clean = orgName.trim().toLowerCase();
  if (clean === 'acme corp' || clean === 'acme') return '11111111-1111-1111-1111-111111111111';
  if (clean === 'globex inc' || clean === 'globex') return '22222222-2222-2222-2222-222222222222';
  
  let hash = 0;
  for (let i = 0; i < clean.length; i++) {
    hash = (hash << 5) - hash + clean.charCodeAt(i);
    hash |= 0;
  }
  const hex = Math.abs(hash).toString(16).padStart(12, '0');
  return `33333333-3333-3333-3333-${hex.slice(0, 12)}`;
}

interface Props {
  onLogin: (persona: UserPersona) => void;
}

export const LoginScreen: React.FC<Props> = ({ onLogin }) => {
  const [activeTab, setActiveTab] = useState<'signin' | 'signup'>('signin');
  
  // Sign In Form States
  const [signInEmail, setSignInEmail] = useState('');
  const [signInPassword, setSignInPassword] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);

  // Sign Up Form States
  const [signUpFullName, setSignUpFullName] = useState('');
  const [signUpEmail, setSignUpEmail] = useState('');
  const [signUpPassword, setSignUpPassword] = useState('');
  const [signUpOrgName, setSignUpOrgName] = useState('');
  const [signUpDesignation, setSignUpDesignation] = useState('');
  const [signUpRole, setSignUpRole] = useState<UserRole>('member');

  const [showQuickFill, setShowQuickFill] = useState(false);
  const [registeredUsers, setRegisteredUsers] = useState<(UserPersona & { password?: string })[]>([]);

  // Load registered users on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(REGISTERED_USERS_KEY);
      if (stored) {
        setRegisteredUsers(JSON.parse(stored));
      } else {
        setRegisteredUsers(DEFAULT_PRESET_USERS);
        localStorage.setItem(REGISTERED_USERS_KEY, JSON.stringify(DEFAULT_PRESET_USERS));
      }
    } catch {
      setRegisteredUsers(DEFAULT_PRESET_USERS);
    }
  }, []);

  // Handle Sign In Submit
  const handleSignIn = (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);

    const cleanEmail = signInEmail.trim().toLowerCase();
    const cleanPassword = signInPassword.trim();

    if (!cleanEmail || !cleanPassword) {
      setAuthError('Please enter both Email and Password.');
      return;
    }

    const found = registeredUsers.find(
      (u) => u.email.toLowerCase() === cleanEmail
    );

    if (!found) {
      setAuthError('No registered account found with this email. Please Sign Up to create an account.');
      return;
    }

    // Authenticate user
    onLogin({
      id: found.id,
      name: found.name,
      role: found.role,
      designation: found.designation || found.role,
      organizationId: found.organizationId,
      organizationName: found.organizationName,
      email: found.email,
    });
  };

  // Handle Sign Up Submit
  const handleSignUp = (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);

    const cleanEmail = signUpEmail.trim().toLowerCase();
    const cleanPassword = signUpPassword.trim();
    const cleanName = signUpFullName.trim() || cleanEmail.split('@')[0];
    const cleanOrg = signUpOrgName.trim();
    const cleanDesig = signUpDesignation.trim() || signUpRole;

    if (!cleanEmail || !cleanPassword || !cleanOrg) {
      setAuthError('Please fill in all required registration fields.');
      return;
    }

    // Check if email already registered
    const existing = registeredUsers.find((u) => u.email.toLowerCase() === cleanEmail);
    if (existing) {
      setAuthError('An account with this email already exists. Please switch to Sign In.');
      return;
    }

    const computedOrgId = generateOrgId(cleanOrg);
    const newUser: UserPersona & { password?: string } = {
      id: `user-${Date.now()}`,
      name: cleanName,
      role: signUpRole,
      designation: cleanDesig,
      organizationId: computedOrgId,
      organizationName: cleanOrg,
      email: cleanEmail,
      password: cleanPassword,
    };

    const updatedUsers = [...registeredUsers, newUser];
    setRegisteredUsers(updatedUsers);
    try {
      localStorage.setItem(REGISTERED_USERS_KEY, JSON.stringify(updatedUsers));
    } catch (err) {
      console.warn('Failed to save registered users to localStorage:', err);
    }

    onLogin({
      id: newUser.id,
      name: newUser.name,
      role: newUser.role,
      designation: newUser.designation,
      organizationId: newUser.organizationId,
      organizationName: newUser.organizationName,
      email: newUser.email,
    });
  };

  const applyQuickFill = (user: typeof DEFAULT_PRESET_USERS[0]) => {
    setActiveTab('signin');
    setSignInEmail(user.email);
    setSignInPassword('password123');
    setAuthError(null);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center items-center p-4 sm:p-6">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-sky-900/30 via-slate-950 to-slate-950 pointer-events-none" />

      <div className="relative z-10 max-w-xl w-full space-y-6">
        {/* Header Title */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-sky-500/10 border border-sky-500/30 text-sky-400 text-xs font-mono font-medium">
            <ShieldCheck className="w-4 h-4" />
            <span>Supabase RLS Multi-Tenant Security Portal</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
            Enterprise Knowledge Hub
          </h1>
          <p className="text-slate-400 text-xs sm:text-sm">
            Sign in to your existing account or register a new organization profile.
          </p>
        </div>

        {/* Auth Card Container */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-2xl backdrop-blur-md space-y-5">
          {/* Tab Selector Buttons */}
          <div className="grid grid-cols-2 gap-2 bg-slate-950 p-1.5 rounded-xl border border-slate-800">
            <button
              type="button"
              onClick={() => { setActiveTab('signin'); setAuthError(null); }}
              className={`py-2 px-4 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                activeTab === 'signin'
                  ? 'bg-sky-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>Sign In</span>
            </button>

            <button
              type="button"
              onClick={() => { setActiveTab('signup'); setAuthError(null); }}
              className={`py-2 px-4 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                activeTab === 'signup'
                  ? 'bg-sky-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>Sign Up</span>
            </button>
          </div>

          {/* Auth Error Banner */}
          {authError && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-300 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{authError}</span>
            </div>
          )}

          {/* TAB 1: SIGN IN FORM */}
          {activeTab === 'signin' && (
            <form onSubmit={handleSignIn} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1 flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-sky-400" />
                  Corporate Email
                </label>
                <input
                  type="email"
                  required
                  value={signInEmail}
                  onChange={(e) => setSignInEmail(e.target.value)}
                  placeholder="e.g. alice@acmecorp.com"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1 flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-sky-400" />
                  Password
                </label>
                <input
                  type="password"
                  required
                  value={signInPassword}
                  onChange={(e) => setSignInPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>

              <button
                type="submit"
                className="w-full mt-4 bg-sky-600 hover:bg-sky-500 text-white font-bold py-3 rounded-xl transition-colors text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg shadow-sky-600/20"
              >
                <span>Sign In to Workspace</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          )}

          {/* TAB 2: SIGN UP FORM */}
          {activeTab === 'signup' && (
            <form onSubmit={handleSignUp} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1 flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-sky-400" />
                    Full Name
                  </label>
                  <input
                    type="text"
                    required
                    value={signUpFullName}
                    onChange={(e) => setSignUpFullName(e.target.value)}
                    placeholder="e.g. Elena Rostova"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1 flex items-center gap-1.5">
                    <Mail className="w-3.5 h-3.5 text-sky-400" />
                    Corporate Email
                  </label>
                  <input
                    type="email"
                    required
                    value={signUpEmail}
                    onChange={(e) => setSignUpEmail(e.target.value)}
                    placeholder="name@company.com"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1 flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-sky-400" />
                  Password
                </label>
                <input
                  type="password"
                  required
                  value={signUpPassword}
                  onChange={(e) => setSignUpPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1 flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5 text-sky-400" />
                    Organization Name
                  </label>
                  <input
                    type="text"
                    required
                    value={signUpOrgName}
                    onChange={(e) => setSignUpOrgName(e.target.value)}
                    placeholder="e.g. Acme Corp, Globex, Stark"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1 flex items-center gap-1.5">
                    <Briefcase className="w-3.5 h-3.5 text-sky-400" />
                    Designation Title
                  </label>
                  <input
                    type="text"
                    required
                    value={signUpDesignation}
                    onChange={(e) => setSignUpDesignation(e.target.value)}
                    placeholder="e.g. Finance Director"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                </div>
              </div>

              {/* Role Selection */}
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-2">
                  Security Clearance Designation Role
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setSignUpRole('member')}
                    className={`p-2.5 rounded-xl border text-left transition-all ${
                      signUpRole === 'member'
                        ? 'bg-emerald-500/10 border-emerald-500 text-emerald-300 font-semibold'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <p className="text-xs font-bold">Employee</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">Public & Internal</p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSignUpRole('manager')}
                    className={`p-2.5 rounded-xl border text-left transition-all ${
                      signUpRole === 'manager'
                        ? 'bg-amber-500/10 border-amber-500 text-amber-300 font-semibold'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <p className="text-xs font-bold">Manager</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">Full Clearance</p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSignUpRole('admin')}
                    className={`p-2.5 rounded-xl border text-left transition-all ${
                      signUpRole === 'admin'
                        ? 'bg-rose-500/10 border-rose-500 text-rose-300 font-semibold'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <p className="text-xs font-bold">Admin</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">System Admin</p>
                  </button>
                </div>
              </div>

              <button
                type="submit"
                className="w-full mt-4 bg-sky-600 hover:bg-sky-500 text-white font-bold py-3 rounded-xl transition-colors text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg shadow-sky-600/20"
              >
                <span>Create Account & Sign In</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          )}

          {/* Quick Auto-Fill Demo Helper */}
          <div className="border-t border-slate-800 pt-4">
            <button
              type="button"
              onClick={() => setShowQuickFill(!showQuickFill)}
              className="text-xs text-sky-400 hover:text-sky-300 font-medium flex items-center justify-between w-full"
            >
              <span className="flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                Quick Sign-In Auto-Fill (Demo Accounts)
              </span>
              {showQuickFill ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>

            {showQuickFill && (
              <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                {DEFAULT_PRESET_USERS.map((u) => (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => applyQuickFill(u)}
                    className="bg-slate-950 hover:bg-slate-800 p-2.5 rounded-lg border border-slate-800 text-left transition-colors"
                  >
                    <p className="font-semibold text-sky-300">{u.name}</p>
                    <p className="text-[10px] text-slate-400">{u.email} • {u.organizationName}</p>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
