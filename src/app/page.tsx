import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Shield, MapPin, CheckCircle, ArrowRight, Lock, Radio, Users, Calendar, BarChart3 } from 'lucide-react';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#f8fafd] text-[#0b1c30] flex flex-col justify-between">
      {/* Top Government Navigation Bar */}
      <header className="w-full bg-white border-b border-slate-200 shadow-xs sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 relative shrink-0 p-0.5 rounded-full border border-blue-200 bg-white">
              <Image
                src="/images/tn-home-guards-logo.png"
                alt="Tamil Nadu Home Guards Emblem"
                width={48}
                height={48}
                className="object-contain"
                priority
              />
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] font-bold tracking-widest text-blue-900 uppercase">
                GOVERNMENT OF TAMIL NADU
              </span>
              <span className="text-base font-bold text-slate-900 tracking-tight leading-tight">
                TAMIL NADU HOME GUARDS
              </span>
              <span className="text-xs font-medium text-slate-500">
                Operational Supervision & Muster Command System
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="px-4 py-2 text-xs sm:text-sm font-semibold rounded-lg bg-blue-800 text-white hover:bg-blue-900 shadow-sm transition-all flex items-center gap-1.5"
            >
              <Lock className="w-3.5 h-3.5" />
              <span>Officer / Guard Login</span>
            </Link>
            <Link
              href="/register"
              className="hidden sm:inline-flex px-4 py-2 text-xs sm:text-sm font-semibold rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 transition-all"
            >
              Volunteer Enlistment
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1 flex flex-col">
        <section className="relative py-16 px-4 sm:px-6 lg:px-8 bg-gradient-to-b from-blue-50/70 via-white to-[#f8fafd] border-b border-slate-200 overflow-hidden">
          <div className="max-w-5xl mx-auto flex flex-col items-center text-center">
            {/* Cadre Badge */}
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-100 text-blue-900 text-xs font-bold border border-blue-200 mb-6">
              <Radio className="w-3.5 h-3.5 text-blue-700 animate-pulse" />
              <span>Official State Police Cadre Command Platform</span>
            </div>

            <h1 className="text-3xl sm:text-5xl font-extrabold text-slate-950 tracking-tight leading-tight max-w-4xl">
              Tamil Nadu Home Guards Supervision & Field Operations
            </h1>

            <p className="mt-4 text-base sm:text-lg text-slate-600 max-w-2xl leading-relaxed">
              Unified digital platform for bandobast deployment, geofenced biometric attendance verification, event planning, and real-time supervisory oversight across all 38 districts of Tamil Nadu.
            </p>

            <div className="mt-8 flex flex-col sm:flex-row items-center gap-4">
              <Link
                href="/login"
                className="w-full sm:w-auto px-6 py-3 rounded-lg bg-blue-800 text-white hover:bg-blue-900 font-bold text-sm shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2"
              >
                <span>Enter Supervision Portal</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                href="/register"
                className="w-full sm:w-auto px-6 py-3 rounded-lg bg-white border border-slate-300 text-slate-800 hover:bg-slate-50 font-semibold text-sm transition-all"
              >
                Submit Volunteer Registration
              </Link>
            </div>

            {/* Quick credentials card for testing */}
            <div className="mt-12 w-full max-w-3xl bg-white rounded-xl border border-blue-200 p-4 shadow-xs text-left">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <span className="text-xs font-bold uppercase tracking-wider text-blue-950 flex items-center gap-1.5">
                  <Shield className="w-4 h-4 text-blue-800" />
                  Direct Role Access for Evaluation
                </span>
                <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                  Ready to test
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-3 text-xs">
                <Link
                  href="/admin/dashboard"
                  className="p-3 rounded-lg bg-slate-50 hover:bg-blue-50 border border-slate-200 hover:border-blue-300 transition-all group"
                >
                  <span className="font-bold text-slate-900 group-hover:text-blue-900 block">State Administrator</span>
                  <span className="text-slate-500 text-[11px] block mt-0.5">Dr. K. Vijayakumar, IPS</span>
                  <span className="text-[10px] text-blue-800 font-mono mt-1 block">TNHG-HQ-001</span>
                </Link>
                <Link
                  href="/commander/dashboard"
                  className="p-3 rounded-lg bg-slate-50 hover:bg-blue-50 border border-slate-200 hover:border-blue-300 transition-all group"
                >
                  <span className="font-bold text-slate-900 group-hover:text-blue-900 block">Area Commander</span>
                  <span className="text-slate-500 text-[11px] block mt-0.5">Insp. S. Rajendran</span>
                  <span className="text-[10px] text-blue-800 font-mono mt-1 block">Zone IV • TN-HG-44029</span>
                </Link>
                <Link
                  href="/homeguard/dashboard"
                  className="p-3 rounded-lg bg-slate-50 hover:bg-blue-50 border border-slate-200 hover:border-blue-300 transition-all group"
                >
                  <span className="font-bold text-slate-900 group-hover:text-blue-900 block">Home Guard Personnel</span>
                  <span className="text-slate-500 text-[11px] block mt-0.5">HG A. Venkatesh</span>
                  <span className="text-[10px] text-blue-800 font-mono mt-1 block">Platoon A-2 • TN-HG-52914</span>
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* Core Operational Modules Grid */}
        <section className="py-14 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full">
          <div className="text-center mb-10">
            <h2 className="text-xs font-bold text-blue-800 uppercase tracking-widest">
              State Police Auxiliary Infrastructure
            </h2>
            <p className="mt-1 text-2xl font-bold text-slate-950">
              Operational Supervision Architecture
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs flex flex-col gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-100 text-blue-900 flex items-center justify-center font-bold">
                <MapPin className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-slate-900">Geofenced Attendance & Muster</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Server-side Haversine coordinate validation against authorized duty perimeters (150m - 250m). Prevents fraudulent remote muster logging.
              </p>
            </div>

            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs flex flex-col gap-3">
              <div className="w-10 h-10 rounded-lg bg-emerald-100 text-emerald-900 flex items-center justify-center font-bold">
                <Calendar className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-slate-900">Bandobast & Duty Rosters</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Automated scheduling for festival crowds, VIP movement, traffic regulation, and disaster response drills across Chennai, Coimbatore, Madurai, and all sectors.
              </p>
            </div>

            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs flex flex-col gap-3">
              <div className="w-10 h-10 rounded-lg bg-amber-100 text-amber-900 flex items-center justify-center font-bold">
                <BarChart3 className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-slate-900">Real-Time Vigilance & Audit</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Strict Row Level Security (RLS) ensuring commanders inspect only their unit, while Home Guards access only personal duties and attendance logs.
              </p>
            </div>
          </div>
        </section>
      </main>

      {/* Official Government Footer */}
      <footer className="bg-slate-900 text-slate-300 py-8 px-4 border-t border-slate-800 text-xs">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Image
              src="/images/tn-home-guards-logo.png"
              alt="Logo"
              width={32}
              height={32}
              className="object-contain"
            />
            <div>
              <span className="font-bold text-white block">Tamil Nadu Home Guards & Civil Defence</span>
              <span className="text-slate-400 text-[11px]">Directorate General of Police, Tamil Nadu Police Headquarters, Chennai</span>
            </div>
          </div>
          <div className="text-slate-400 text-right">
            <span>Control Room Helpline: 044-28447700</span>
            <span className="block text-[11px] text-slate-500">Secure Government Network • All Rights Reserved</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
