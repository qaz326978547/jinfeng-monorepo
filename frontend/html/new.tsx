import React, { useState, useEffect } from 'react';
import { Menu, X, Users, BookOpen, MessageCircle, CheckCircle, Star, ArrowRight, Mail, Phone, MapPin, ChevronRight, CreditCard, AlertCircle, PlayCircle, FileText, Newspaper, Shield, Gavel, UserCheck, Calculator, Cloud, Briefcase } from 'lucide-react';

const LaborServiceWeb = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [currentHeroSlide, setCurrentHeroSlide] = useState(0);

  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen);
  };

  // 模擬輪播圖片效果
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentHeroSlide((prev) => (prev + 1) % 3);
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  const navLinks = [
    { name: '勞動法務速成講座報名', href: '#hero' },
    { name: '服務項目', href: '#services' },
    { name: '關於我們', href: '#about' },
    { name: '勞資NEWS', href: '#news' },
    { name: '勞資分分通', href: '#videos' },
    { name: '聯絡我們', href: '#contact' },
  ];

  const services = [
    { icon: <FileText />, title: '量身訂做勞動契約', desc: '依據企業屬性，制定合規且完善的勞動契約。' },
    { icon: <BookOpen />, title: '客製化工作規則並協助送審', desc: '建立明確管理制度，並協助完成政府核備程序。' },
    { icon: <Calculator />, title: '薪資結構調整', desc: '優化薪資設計，符合法規並兼顧經營成本。' },
    { icon: <Shield />, title: '職業災害風險轉嫁規劃', desc: '完善的保險規劃，降低企業職災賠償風險。' },
    { icon: <UserCheck />, title: '規劃人才留根計畫', desc: '設計激勵機制，留住核心人才，降低流動率。' },
    { icon: <Users />, title: '協助成立勞資會議', desc: '輔導召開勞資會議，促進雙方溝通與和諧。' },
    { icon: <Gavel />, title: '勞資爭議處理', desc: '專業協調與法律諮詢，快速解決勞資糾紛。' },
    { icon: <AlertCircle />, title: '工作場所性騷擾防治', desc: '協助訂立防治措施，建立友善職場環境。' },
    { icon: <Cloud />, title: '專利雲端打卡系統', desc: '數位化出勤管理，精準紀錄工時，避免爭議。' },
    { icon: <Briefcase />, title: '勞動檢查預防及處理', desc: '模擬勞檢實況，協助企業提前改善缺失。' },
  ];

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-800">
      {/* Navigation */}
      <nav className="fixed w-full bg-white shadow-md z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-20">
            <div className="flex-shrink-0 flex items-center">
              <div className="text-xl md:text-2xl font-bold text-blue-900 tracking-wider">
                金豐集團<span className="text-amber-500">.</span>
              </div>
            </div>
            
            {/* Desktop Menu */}
            <div className="hidden lg:flex space-x-6">
              {navLinks.map((link) => (
                <a
                  key={link.name}
                  href={link.href}
                  className="text-sm font-medium text-slate-600 hover:text-blue-900 transition duration-300"
                >
                  {link.name}
                </a>
              ))}
              <a 
                href="#contact"
                className="bg-amber-500 text-white px-4 py-2 rounded-full text-sm font-medium hover:bg-amber-600 transition duration-300 shadow-md"
              >
                免費諮詢
              </a>
            </div>

            {/* Mobile Menu Button */}
            <div className="lg:hidden flex items-center">
              <button
                onClick={toggleMenu}
                className="text-slate-600 hover:text-blue-900 focus:outline-none"
              >
                {isMenuOpen ? <X size={28} /> : <Menu size={28} />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Menu Dropdown */}
        {isMenuOpen && (
          <div className="lg:hidden bg-white border-t border-slate-100 absolute w-full shadow-xl">
            <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3">
              {navLinks.map((link) => (
                <a
                  key={link.name}
                  href={link.href}
                  onClick={() => setIsMenuOpen(false)}
                  className="block px-3 py-2 rounded-md text-base font-medium text-slate-700 hover:text-blue-900 hover:bg-slate-50"
                >
                  {link.name}
                </a>
              ))}
            </div>
          </div>
        )}
      </nav>

      {/* Hero Section (Carousel Simulation) */}
      <header id="hero" className="relative bg-blue-900 pt-32 pb-20 lg:pt-48 lg:pb-32 overflow-hidden min-h-[600px] flex items-center">
        {/* Background Slides */}
        <div className={`absolute inset-0 transition-opacity duration-1000 ${currentHeroSlide === 0 ? 'opacity-20' : 'opacity-0'}`}>
           <svg className="h-full w-full bg-blue-800" viewBox="0 0 100 100" preserveAspectRatio="none"><path d="M0 100 L100 0 L100 100 Z" fill="#1e3a8a" /></svg>
        </div>
        <div className={`absolute inset-0 transition-opacity duration-1000 ${currentHeroSlide === 1 ? 'opacity-20' : 'opacity-0'}`}>
           <svg className="h-full w-full bg-indigo-900" viewBox="0 0 100 100" preserveAspectRatio="none"><circle cx="50" cy="50" r="40" fill="#312e81" /></svg>
        </div>
        <div className={`absolute inset-0 transition-opacity duration-1000 ${currentHeroSlide === 2 ? 'opacity-20' : 'opacity-0'}`}>
           <svg className="h-full w-full bg-slate-800" viewBox="0 0 100 100" preserveAspectRatio="none"><rect x="20" y="20" width="60" height="60" fill="#1e293b" /></svg>
        </div>
        
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center">
          <div className="max-w-4xl mx-auto">
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white leading-tight mb-6 drop-shadow-lg">
              勞動法務速成講座 <br />
              <span className="text-amber-400">預防 90% 勞資爭議</span>
            </h1>
            <p className="text-xl text-blue-100 mb-10 leading-relaxed max-w-2xl mx-auto">
              協助兩岸企業降低人事成本，創造勞資雙贏，提升企業整體競爭力。
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <a 
                href="#contact" 
                className="inline-flex items-center justify-center px-8 py-4 border border-transparent text-lg font-bold rounded-lg text-blue-900 bg-amber-400 hover:bg-amber-500 transition duration-300 shadow-lg transform hover:scale-105"
              >
                立即報名講座
                <ArrowRight className="ml-2 h-5 w-5" />
              </a>
              <a 
                href="#services" 
                className="inline-flex items-center justify-center px-8 py-4 border border-white text-lg font-medium rounded-lg text-white hover:bg-white hover:bg-opacity-10 transition duration-300"
              >
                了解服務項目
              </a>
            </div>
          </div>
          
          {/* Carousel Indicators */}
          <div className="flex justify-center mt-12 space-x-2">
            {[0, 1, 2].map((index) => (
              <button
                key={index}
                onClick={() => setCurrentHeroSlide(index)}
                className={`w-3 h-3 rounded-full transition-all ${currentHeroSlide === index ? 'bg-amber-400 w-6' : 'bg-white/50'}`}
              />
            ))}
          </div>
        </div>
      </header>

      {/* Services Section */}
      <section id="services" className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-blue-900 font-bold text-base uppercase tracking-wider mb-2">Our Services</h2>
            <h3 className="text-3xl md:text-4xl font-bold text-slate-900">10 大專業服務項目</h3>
            <div className="w-20 h-1 bg-amber-500 mx-auto mt-4 rounded-full"></div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
            {services.map((service, index) => (
              <div key={index} className="bg-slate-50 p-6 rounded-xl border border-slate-100 hover:shadow-lg hover:-translate-y-1 transition duration-300 group">
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4 group-hover:bg-blue-900 transition duration-300 text-blue-900 group-hover:text-white">
                  {service.icon}
                </div>
                <h4 className="text-lg font-bold text-slate-900 mb-2">{service.title}</h4>
                <p className="text-sm text-slate-600 leading-relaxed">
                  {service.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* About Us Section */}
      <section id="about" className="py-20 bg-slate-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-blue-900 font-bold text-base uppercase tracking-wider mb-2">About Us</h2>
              <h3 className="text-3xl md:text-4xl font-bold text-slate-900 mb-6">關於金豐集團</h3>
              <p className="text-slate-600 mb-6 leading-relaxed">
                企業在經營管理上所面臨最大的難題，乃在於公司內部人員的勞動法務管理、規章制度的建立以及衍生的人事成本控制。
              </p>
              <p className="text-slate-600 mb-8 leading-relaxed">
                金豐集團為協助兩岸企業，提供勞動法相關的專業諮詢以及顧問協助，幫助企業在勞動法務管理上，降低人事成本及勞資爭議並創造勞資雙贏、提升企業整體競爭力。
              </p>

              <div className="space-y-4 border-l-4 border-amber-400 pl-6">
                <div className="relative">
                  <span className="font-bold text-blue-900">1995年</span>
                  <p className="text-slate-700">成立 金豐企業管理顧問股份有限公司</p>
                </div>
                <div className="relative">
                  <span className="font-bold text-blue-900">2005年</span>
                  <p className="text-slate-700">成立 上海善緣企業管理諮詢有限公司</p>
                </div>
                <div className="relative">
                  <span className="font-bold text-blue-900">2007年</span>
                  <p className="text-slate-700">成立 金豐企業管理諮詢顧問(昆山)有限公司</p>
                </div>
                <div className="relative">
                  <span className="font-bold text-blue-900">2015年</span>
                  <p className="text-slate-700">成立 善緣(廈門)勞資管理有限公司</p>
                </div>
              </div>
            </div>
            <div className="relative">
              <div className="bg-white p-4 rounded-2xl shadow-xl transform rotate-3 hover:rotate-0 transition duration-500">
                 {/* Placeholder for Company Certificate Image */}
                 <div className="aspect-[4/3] bg-slate-200 rounded-lg flex items-center justify-center">
                    <span className="text-slate-400 font-medium flex flex-col items-center">
                       <Shield size={48} className="mb-2" />
                       公司證書展示
                    </span>
                 </div>
                 <p className="text-center text-sm text-slate-500 mt-4">專業認證，值得信賴</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Why Choose Us (Kept as it supports sales pitch) */}
      <section id="why-us" className="py-20 bg-slate-900 text-white relative overflow-hidden">
        <div className="absolute top-0 right-0 -mr-20 -mt-20 w-80 h-80 rounded-full bg-blue-800 opacity-20 blur-3xl"></div>
        <div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-80 h-80 rounded-full bg-amber-600 opacity-10 blur-3xl"></div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center">
            <h2 className="text-amber-400 font-bold text-base uppercase tracking-wider mb-2">Why Us</h2>
            <h3 className="text-3xl md:text-4xl font-bold mb-12">我們的優勢</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-left">
                <div className="bg-white/5 p-8 rounded-2xl border border-white/10">
                    <CheckCircle className="text-amber-400 mb-4 h-8 w-8" />
                    <h4 className="text-xl font-bold mb-2">專業團隊陣容</h4>
                    <p className="text-slate-300">豐富實務經驗與專業知識，幫助您掌握重要議題。</p>
                </div>
                <div className="bg-white/5 p-8 rounded-2xl border border-white/10">
                    <CheckCircle className="text-amber-400 mb-4 h-8 w-8" />
                    <h4 className="text-xl font-bold mb-2">實用落地內容</h4>
                    <p className="text-slate-300">課程設計貼近實際，直接應用於工作現場。</p>
                </div>
                <div className="bg-white/5 p-8 rounded-2xl border border-white/10">
                    <CheckCircle className="text-amber-400 mb-4 h-8 w-8" />
                    <h4 className="text-xl font-bold mb-2">顧客滿意保證</h4>
                    <p className="text-slate-300">重視反饋，持續改進，確保您的收穫。</p>
                </div>
            </div>
        </div>
      </section>

      {/* News Section */}
      <section id="news" className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-blue-900 font-bold text-base uppercase tracking-wider mb-2">Labor News</h2>
            <h3 className="text-3xl md:text-4xl font-bold text-slate-900">勞資 NEWS</h3>
            <p className="text-slate-500 mt-4">掌握最新勞動法令動態與實務案例</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
             {/* Mock News Cards - Simulating Link Previews */}
             {[1, 2, 3].map((item) => (
               <div key={item} className="bg-slate-50 rounded-xl overflow-hidden border border-slate-200 hover:shadow-lg transition group cursor-pointer">
                 <div className="h-48 bg-slate-200 flex items-center justify-center relative overflow-hidden">
                    <Newspaper className="text-slate-400 h-12 w-12" />
                    <div className="absolute inset-0 bg-blue-900/0 group-hover:bg-blue-900/10 transition duration-300"></div>
                 </div>
                 <div className="p-6">
                   <span className="text-xs font-bold text-amber-500 uppercase mb-2 block">Latest News</span>
                   <h4 className="text-lg font-bold text-slate-900 mb-2 group-hover:text-blue-700 transition">最新勞動法令修正重點解析 - {item}</h4>
                   <p className="text-sm text-slate-600 mb-4 line-clamp-2">
                     本月勞動部發布最新函釋，針對加班費計算方式有新的見解，企業人資應多加留意以免觸法...
                   </p>
                   <span className="text-blue-600 text-sm font-medium flex items-center">
                     閱讀更多 <ChevronRight size={16} />
                   </span>
                 </div>
               </div>
             ))}
          </div>
          <p className="text-center text-xs text-slate-400 mt-8">* 新聞連結圖片功能需後端系統支援，此處為示意畫面。</p>
        </div>
      </section>

      {/* Videos Section (勞資分分通) */}
      <section id="videos" className="py-20 bg-slate-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
           <div className="text-center mb-16">
            <h2 className="text-blue-900 font-bold text-base uppercase tracking-wider mb-2">Videos</h2>
            <h3 className="text-3xl md:text-4xl font-bold text-slate-900">勞資分分通</h3>
            <p className="text-slate-500 mt-4">短影片專區 - 3分鐘搞懂勞資大小事</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
             {[1, 2, 3, 4].map((item) => (
                <div key={item} className="aspect-[9/16] bg-slate-800 rounded-2xl relative overflow-hidden group cursor-pointer shadow-lg mx-auto w-full max-w-[280px]">
                   <div className="absolute inset-0 flex items-center justify-center">
                      <PlayCircle className="text-white opacity-70 group-hover:opacity-100 transform group-hover:scale-110 transition duration-300 w-16 h-16" />
                   </div>
                   <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent">
                      <p className="text-white font-medium text-sm">EP.{item} 勞資爭議如何自保？律師告訴你重點</p>
                   </div>
                </div>
             ))}
          </div>
        </div>
      </section>

      {/* Payment & Contact Section */}
      <section id="contact" className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="text-center mb-16">
            <h2 className="text-blue-900 font-bold text-base uppercase tracking-wider mb-2">Contact Us</h2>
            <h3 className="text-3xl md:text-4xl font-bold text-slate-900">報名與聯絡資訊</h3>
            <div className="w-20 h-1 bg-amber-500 mx-auto mt-4 rounded-full"></div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Left Side: Contact Info & Payment Info */}
            <div className="lg:col-span-5 space-y-8">
              
              {/* Contact Card */}
              <div className="bg-slate-50 p-8 rounded-2xl shadow-sm border border-slate-200">
                <h4 className="text-xl font-bold text-blue-900 mb-6 flex items-center">
                  <Phone className="mr-2" size={24} /> 聯絡我們
                </h4>
                <div className="space-y-4">
                  <div>
                    <p className="text-sm text-slate-500">聯絡人</p>
                    <p className="text-lg font-bold text-slate-800">吳冠璋 經理</p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">聯絡電話</p>
                    <p className="font-medium text-slate-800 flex flex-col sm:flex-row sm:gap-4">
                      <a href="tel:0930532215" className="hover:text-blue-600">0930-532-215</a>
                      <a href="tel:0916834966" className="hover:text-blue-600">0916-834-966</a>
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">電子信箱</p>
                    <a href="mailto:a0930532215@gmail.com" className="text-blue-600 hover:underline">a0930532215@gmail.com</a>
                  </div>
                  <div>
                     <a 
                      href="https://lin.ee/9MI6Yao" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-center w-full bg-[#06C755] text-white px-4 py-3 rounded-lg font-bold hover:bg-[#05b34c] transition shadow-md"
                    >
                      <MessageCircle className="mr-2" />
                      加 LINE 好友諮詢
                    </a>
                  </div>
                </div>
              </div>

              {/* Payment Info Card */}
              <div className="bg-blue-900 p-8 rounded-2xl shadow-lg text-white">
                <h4 className="text-xl font-bold mb-6 flex items-center text-amber-400">
                  <CreditCard className="mr-2" size={24} /> 轉帳繳款資訊
                </h4>
                <div className="space-y-4 text-blue-50">
                  <div className="flex justify-between border-b border-blue-700 pb-2">
                    <span>銀行代碼</span>
                    <span className="font-mono">808 (玉山)</span>
                  </div>
                  <div className="flex justify-between border-b border-blue-700 pb-2">
                    <span>分行名稱</span>
                    <span>玉山銀行 - 北高雄分行</span>
                  </div>
                  <div className="pb-2">
                    <p className="text-xs text-blue-300 mb-1">匯款帳號</p>
                    <p className="text-2xl font-mono font-bold text-white tracking-wider">0347-440-029556</p>
                  </div>
                  <div className="pb-2">
                    <p className="text-xs text-blue-300 mb-1">戶名</p>
                    <p className="font-bold">金豐企業管理顧問股份有限公司</p>
                  </div>
                  <div className="flex items-start bg-blue-800/50 p-3 rounded-lg text-sm">
                    <CheckCircle size={16} className="mt-0.5 mr-2 text-amber-400 flex-shrink-0" />
                    <p>我們將提供金豐企業管理顧問股份有限公司發票</p>
                  </div>
                </div>
              </div>

              {/* Warning/Deadline Card */}
               <div className="bg-amber-50 p-6 rounded-2xl border border-amber-200 text-amber-900">
                <h4 className="font-bold flex items-center mb-3">
                  <AlertCircle className="mr-2" size={20} /> 報名截止與退費規定
                </h4>
                <ul className="list-disc list-inside space-y-2 text-sm">
                  <li><strong>報名截止日期：</strong>講座前一週。</li>
                  <li>截止日後不能退費。</li>
                  <li>若要延期需加收延期費 <span className="font-bold text-red-600">$500</span>。</li>
                  <li><span className="font-bold text-red-600">台北場</span>需重新報名，無法延期。</li>
                </ul>
              </div>
            </div>

            {/* Right Side: Contact Form */}
            <div className="lg:col-span-7">
              <div className="bg-white p-8 md:p-10 rounded-2xl shadow-lg border border-slate-200 h-full">
                <h4 className="text-2xl font-bold text-slate-800 mb-6">講座報名 / 免費諮詢</h4>
                <p className="text-slate-600 mb-8">
                  請填寫以下資訊，我們的團隊將在收到後盡快與您聯繫。
                </p>
                <form className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label htmlFor="company" className="block text-sm font-medium text-slate-700 mb-1">公司名稱</label>
                      <input type="text" id="company" className="w-full px-4 py-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition bg-slate-50" placeholder="請輸入公司名稱" />
                    </div>
                     <div>
                      <label htmlFor="taxId" className="block text-sm font-medium text-slate-700 mb-1">統一編號</label>
                      <input type="text" id="taxId" className="w-full px-4 py-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition bg-slate-50" placeholder="8碼統編" />
                    </div>
                  </div>
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label htmlFor="name" className="block text-sm font-medium text-slate-700 mb-1">聯絡人姓名</label>
                      <input type="text" id="name" className="w-full px-4 py-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition bg-slate-50" placeholder="請輸入姓名" />
                    </div>
                    <div>
                      <label htmlFor="jobTitle" className="block text-sm font-medium text-slate-700 mb-1">職稱</label>
                      <input type="text" id="jobTitle" className="w-full px-4 py-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition bg-slate-50" placeholder="請輸入職稱" />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label htmlFor="phone" className="block text-sm font-medium text-slate-700 mb-1">聯絡電話</label>
                      <input type="tel" id="phone" className="w-full px-4 py-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition bg-slate-50" placeholder="09xx-xxx-xxx" />
                    </div>
                    <div>
                      <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-1">電子信箱</label>
                      <input type="email" id="email" className="w-full px-4 py-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition bg-slate-50" placeholder="name@example.com" />
                    </div>
                  </div>
                  <div>
                    <label htmlFor="interest" className="block text-sm font-medium text-slate-700 mb-1">諮詢項目</label>
                    <select id="interest" className="w-full px-4 py-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition bg-slate-50">
                      <option>報名-勞動法務速成講座</option>
                      <option>諮詢-勞動契約/工作規則</option>
                      <option>諮詢-薪資結構調整</option>
                      <option>諮詢-職災風險/勞資爭議</option>
                      <option>其他合作洽談</option>
                    </select>
                  </div>
                  <div>
                    <label htmlFor="message" className="block text-sm font-medium text-slate-700 mb-1">留言內容 / 匯款末五碼</label>
                    <textarea id="message" rows={4} className="w-full px-4 py-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition bg-slate-50" placeholder="若已匯款，請在此填寫帳號末五碼，方便我們對帳。"></textarea>
                  </div>
                  <button type="submit" className="w-full bg-blue-900 hover:bg-blue-800 text-white font-bold py-4 rounded-lg shadow-lg transition duration-300 transform hover:-translate-y-1 flex justify-center items-center">
                    送出資訊 <ArrowRight className="ml-2" size={20} />
                  </button>
                  <p className="text-xs text-slate-500 text-center mt-4">
                    提交即表示您同意我們的服務條款與隱私政策。
                  </p>
                </form>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-900 text-slate-400 py-12 border-t border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row justify-between items-center">
          <div className="mb-4 md:mb-0 text-center md:text-left">
            <h2 className="text-2xl font-bold text-white mb-2">金豐集團<span className="text-amber-500">.</span></h2>
            <p className="text-sm">協助兩岸企業降低人事成本，創造勞資雙贏</p>
          </div>
          <div className="flex space-x-6 text-sm">
            <a href="#" className="hover:text-white transition">隱私權政策</a>
            <a href="#" className="hover:text-white transition">服務條款</a>
          </div>
        </div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8 text-center text-xs text-slate-600">
          &copy; {new Date().getFullYear()} LaborService5690.com All rights reserved.
        </div>
      </footer>
    </div>
  );
};

export default LaborServiceWeb;