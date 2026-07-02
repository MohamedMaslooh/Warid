// SPDX-License-Identifier: AGPL-3.0-or-later

const STRINGS = {
  en: {
    'brand': 'Warid',
    'nav.features': 'Features',
    'nav.how': 'How it works',
    'nav.showcase': 'In the app',
    'nav.faq': 'FAQ',
    'hero.eyebrow': 'Open source · Arabic + English · Local-first',
    'hero.headline.1': 'Your voice,',
    'hero.headline.2': 'as clean text.',
    'hero.lead': 'Warid is a tiny desktop app that records your voice and turns it into clean text in seconds, using your own free Google Gemini key. Speak in any language and get output in any language. Press <span class="kbd">Ctrl</span> + <span class="kbd">Alt</span> + <span class="kbd">R</span> anywhere on your computer.',
    'hero.cta': '<i data-lucide="download" stroke-width="1.75"></i> Download Now',
    'hero.meta.free': 'Free',
    'hero.meta.oss': 'Open source',
    'hero.meta.size': '~10 MB · ~30 MB RAM',
    'features.label': 'Features',
    'features.title': 'Built for fast, bilingual thinking.',
    'features.sub': 'Warid is small, sharp, and stays out of your way. Everything happens through one keyboard shortcut.',
    'f.hotkey.t': 'Global hotkey',
    'f.hotkey.d': 'Press Ctrl+Alt+R anywhere, even while another app is focused, and start dictating.',
    'f.bilingual.t': 'Native Arabic + English',
    'f.bilingual.d': 'Full RTL support and code-switching. Talk in multiple languages in the same sentence. Warid handles it.',
    'f.templates.t': 'Custom commands',
    'f.templates.d': 'Transcribe, translate, polish, format emails, write code. Each command has its own prompt, model, and hotkey.',
    'f.privacy.t': 'Your key, your data',
    'f.privacy.d': 'Audio goes straight from your machine to Google. No middleman, no analytics, no telemetry.',
    'f.history.t': 'Local history & search',
    'f.history.d': 'Every transcription is saved to a local SQLite database. Search the full text instantly.',
    'f.analytics.t': 'Word & speed analytics',
    'f.analytics.d': 'Track total words, sessions, time saved, effective WPM, streaks, and milestone progress. All stored locally.',
    'how.label': 'How it works',
    'how.title': 'From idea to clean text in three steps.',
    'how.sub': 'No accounts to create. No subscription. No data leaves your machine except the audio you choose to send.',
    'how.s1.t': 'Get a free Gemini key',
    'how.s1.d': 'Sign in with any Google account at Google AI Studio and copy your API key. The free tier covers most users entirely.',
    'how.s1.cta': 'Open AI Studio <i data-lucide="arrow-right" stroke-width="1.75" style="width:14px;height:14px;vertical-align:-2px;"></i>',
    'how.s2.t': 'Press the hotkey, talk',
    'how.s2.d': 'Hit <span class="kbd">Ctrl</span> + <span class="kbd">Alt</span> + <span class="kbd">R</span> in any app. A tiny pill appears at the top of your screen. Stop the recording when done.',
    'how.s3.t': 'Get text, instantly',
    'how.s3.d': 'Your transcription streams in, gets auto-copied to your clipboard, and is saved to local history. Paste it anywhere.',
    'show.label': 'In the app',
    'show.title': 'A look around Warid.',
    'show.sub': 'Every screen is rendered in real HTML and CSS, exactly what you\'ll see after you install it.',
    'show.rec.tag': 'Home',
    'show.rec.t': 'Record. Watch text appear.',
    'show.rec.d': 'A single circular button. Press it or use the hotkey. Output streams into the left panel while a pulse indicator and live waveform show that Warid is listening.',
    'show.an.tag': 'Analytics',
    'show.an.t': 'See how much you\'ve spoken.',
    'show.an.d': 'Warid quietly counts every word you transcribe. A heatmap shows your active days, a progress bar tracks the next milestone, and a top-words list reveals what you actually talk about.',
    'show.tpl.tag': 'Commands',
    'show.tpl.t': 'One hotkey per use case.',
    'show.tpl.d': 'Make Warid do more than transcribe. Each command carries its own prompt, output language, model, and global hotkey, so the same voice clip can become a polished email or formatted code.',
    'show.set.tag': 'Settings',
    'show.set.t': 'Everything you\'d expect, nothing you wouldn\'t.',
    'show.set.d': 'Your Gemini key is stored in the OS keychain. Pick a model, change the language, switch theme, decide what to auto-copy, and you\'re done.',
    'faq.label': 'Questions',
    'faq.title': 'Frequently asked.',
    'faq.q1': 'Is Warid really free?',
    'faq.a1': 'Yes. The app is open-source under the AGPLv3 license and costs nothing. You\'ll need a free Google Gemini API key, which Google provides on a generous free tier that\'s more than enough for most personal use.',
    'faq.q2': 'Where does my audio go?',
    'faq.a2': 'Straight from your machine to Google\'s Gemini API using your own key. Warid has no server. We don\'t see, log, or store anything. There\'s no analytics or telemetry of any kind.',
    'faq.q3': 'Which languages does it support?',
    'faq.a3': 'Any language Gemini supports will work, which covers virtually every major language in the world. Arabic and English get extra attention for RTL layout and code-switching, but you can speak and receive output in any language.',
    'faq.q4': 'Can I run it offline?',
    'faq.a4': 'The app runs offline, but transcription itself sends audio to Gemini, which requires an internet connection. A fully on-device mode is on the roadmap.',
    'faq.q5': 'Why do I need my own API key?',
    'faq.a5': 'So your data stays yours and there are no usage caps we impose. Your key lives in your operating system\'s keychain. Warid reads it only when it needs to make a request.',
    'faq.q6': 'Is it on the Microsoft Store or Mac App Store?',
    'faq.a6': 'Not yet. For now, download the installer for your platform from this page and run it. Both signed builds and store listings are planned.',
    'dl.label': 'Download',
    'dl.title': 'Pick your platform.',
    'dl.sub': 'Free, open-source, ~10 MB. Drop in your Gemini API key and you\'re ready.',
    'dl.win.title': 'Windows',
    'dl.win.cta': '<i data-lucide="download" stroke-width="1.75"></i> Download',
    'dl.win.req': 'Windows 10 or later · x64',
    'dl.mac.title': 'macOS',
    'dl.mac.cta': '<i data-lucide="download" stroke-width="1.75"></i> Download',
    'dl.mac.intel': 'Intel version →',
    'dl.mac.note': 'Unsigned app — macOS blocks it on first launch. To open: run <code>xattr -cr /Applications/Warid.app</code> in Terminal, then launch normally. See the README for other macOS versions.',
    'dl.linux.title': 'Linux',
    'dl.linux.cta': '<i data-lucide="download" stroke-width="1.75"></i> Download',
    'dl.linux.req': 'Ubuntu 22.04 · Debian · Fedora · amd64',
    'footer.copy': '© 2026 Warid · Open source under AGPLv3',
    'footer.gh': 'GitHub',
    'footer.releases': 'Releases',
    'footer.issues': 'Issues',
    'footer.license': 'License',
    'mk.rec.frame': 'Warid · Home',
    'mk.rec.ph': 'Recording',
    'mk.rec.chip': 'Transcribe · <span class="kbd" style="margin-inline-start:4px;">Ctrl</span> <span class="kbd">Alt</span> <span class="kbd">R</span>',
    'mk.rec.elapsed': 'elapsed',
    'mk.rec.wpm': 'wpm',
    'mk.rec.words': 'words',
    'mk.rec.text': 'Today I want to outline the rollout plan for the new onboarding flow. The main goal is to reduce time-to-first-value, so we\'ll start by trimming the welcome screen to two steps (language and API key) and defer everything else until after the first successful recording',
    'mk.rec.side': 'Recording',
    'mk.rec.cancel': 'Press <span class="kbd">Esc</span> to cancel',
    'mk.an.frame': 'Warid · Analytics',
    'mk.an.ph': 'Analytics',
    'mk.an.sessions': '147 sessions',
    'mk.an.streak': '<i data-lucide="flame" stroke-width="1.75" style="width:12px;height:12px;"></i> 12-day streak',
    'mk.an.eyebrow': 'Words transcribed',
    'mk.an.unit': 'words',
    'mk.an.sub': '~51% to next milestone · 25,000 words',
    'mk.an.m1': '5K · achieved',
    'mk.an.m2': '25K · ETA Jun 12',
    'mk.an.l1': 'Time saved vs typing',
    'mk.an.l2': 'Effective speed',
    'mk.an.l3': 'Milestones',
    'mk.an.hm': 'Last 26 weeks',
    'mk.tpl.frame': 'Warid · Commands',
    'mk.tpl.ph': 'Commands',
    'mk.tpl.active': '4 active',
    'mk.tpl.new': '<i data-lucide="plus" stroke-width="1.75" style="width:12px;height:12px;"></i> New',
    'mk.tpl.i1': 'Transcribe',
    'mk.tpl.i2': 'Translate &amp; Polish',
    'mk.tpl.i3': 'Coding Assistant',
    'mk.tpl.i4': 'Format Email',
    'mk.tpl.l.name': 'Name',
    'mk.tpl.l.prompt': 'Prompt',
    'mk.tpl.l.out': 'Output',
    'mk.tpl.l.model': 'Model',
    'mk.tpl.l.hotkey': 'Hotkey',
    'mk.tpl.v.name': 'Translate &amp; Polish',
    'mk.tpl.v.prompt': 'Translate the audio to English. Fix grammar, remove filler words, and produce a clean professional version. Preserve the speaker\'s intent and tone.',
    'mk.tpl.v.out': 'English <i data-lucide="chevron-down" stroke-width="1.75" style="width:12px;height:12px;"></i>',
    'mk.set.frame': 'Warid · Settings',
    'mk.set.ph': 'Settings',
    'mk.set.h1': 'API Keys',
    'mk.set.h2': 'Model',
    'mk.set.h3': 'Behavior',
    'mk.set.h4': 'Appearance',
    'mk.set.openrouter': 'OpenRouter (optional)',
    'mk.set.notset': 'Not set',
    'mk.set.defmodel': 'Default model',
    'mk.set.autocopy': 'Auto-copy output to clipboard',
    'mk.set.history': 'Save transcriptions to history',
    'mk.set.startup': 'Launch on startup',
    'mk.set.theme.lbl': 'Theme',
    'mk.set.system': 'System',
    'mk.set.lang.lbl': 'Interface language',
  },
  ar: {
    'brand': 'وارِد',
    'nav.features': 'المميزات',
    'nav.how': 'كيف يعمل',
    'nav.showcase': 'داخل التطبيق',
    'nav.faq': 'الأسئلة الشائعة',
    'hero.eyebrow': 'مفتوح المصدر · عربي + إنجليزي · محلي',
    'hero.headline.1': 'صوتك،',
    'hero.headline.2': 'نصاً نظيفاً.',
    'hero.lead': 'وارِد تطبيق سطح مكتب صغير يحوّل صوتك إلى نص نظيف في ثوانٍ، باستخدام مفتاح Google Gemini المجاني الخاص بك. تحدث بأي لغة واحصل على النص بأي لغة تريد. اضغط <span class="kbd">Ctrl</span> + <span class="kbd">Alt</span> + <span class="kbd">R</span> من أي مكان.',
    'hero.cta': '<i data-lucide="download" stroke-width="1.75"></i> تحميل الآن',
    'hero.meta.free': 'مجاني',
    'hero.meta.oss': 'مفتوح المصدر',
    'hero.meta.size': '~10 ميغابايت · ~30 ميغابايت رام',
    'features.label': 'المميزات',
    'features.title': 'مبني للتفكير السريع ثنائي اللغة.',
    'features.sub': 'وارِد صغير وحاد ويبقى بعيداً عن طريقك. كل شيء يتم من خلال اختصار لوحة مفاتيح واحد.',
    'f.hotkey.t': 'اختصار عالمي',
    'f.hotkey.d': 'اضغط Ctrl+Alt+R من أي مكان، حتى أثناء تشغيل تطبيق آخر، وابدأ الإملاء.',
    'f.bilingual.t': 'عربي + إنجليزي أصلي',
    'f.bilingual.d': 'دعم كامل للكتابة من اليمين لليسار والتبديل بين اللغات. تحدث بعدة لغات في نفس الجملة. وارِد يتعامل معها.',
    'f.templates.t': 'أوامر مخصصة',
    'f.templates.d': 'نسخ، ترجمة، تلميع، تنسيق رسائل، كتابة أكواد. كل أمر بموجّهه ونموذجه واختصاره الخاص.',
    'f.privacy.t': 'مفتاحك، بياناتك',
    'f.privacy.d': 'الصوت يذهب مباشرة من جهازك إلى Google. لا وسيط، لا تحليلات، لا تتبع.',
    'f.history.t': 'سجل محلي وبحث',
    'f.history.d': 'كل نسخ يُحفظ في قاعدة بيانات SQLite محلية. ابحث في النص الكامل فوراً.',
    'f.analytics.t': 'تحليلات الكلمات والسرعة',
    'f.analytics.d': 'تتبع إجمالي الكلمات، الجلسات، الوقت الموفّر، الكلمات في الدقيقة، التتابع، وتقدم الأهداف. كل شيء مخزن محلياً.',
    'how.label': 'كيف يعمل',
    'how.title': 'من الفكرة إلى نص نظيف في ثلاث خطوات.',
    'how.sub': 'لا حسابات تُنشأ. لا اشتراك. لا بيانات تغادر جهازك باستثناء الصوت الذي تختار إرساله.',
    'how.s1.t': 'احصل على مفتاح Gemini مجاني',
    'how.s1.d': 'سجّل دخولك بأي حساب Google في Google AI Studio وانسخ مفتاح API الخاص بك. الطبقة المجانية تكفي معظم المستخدمين تماماً.',
    'how.s1.cta': 'افتح AI Studio <i data-lucide="arrow-right" stroke-width="1.75" style="width:14px;height:14px;vertical-align:-2px;"></i>',
    'how.s2.t': 'اضغط الاختصار، تحدث',
    'how.s2.d': 'اضغط <span class="kbd">Ctrl</span> + <span class="kbd">Alt</span> + <span class="kbd">R</span> في أي تطبيق. تظهر حبة صغيرة في أعلى شاشتك. أوقف التسجيل عند الانتهاء.',
    'how.s3.t': 'احصل على النص فوراً',
    'how.s3.d': 'يتدفق نسخك، يُنسخ تلقائياً إلى الحافظة، ويُحفظ في السجل المحلي. الصقه في أي مكان.',
    'show.label': 'داخل التطبيق',
    'show.title': 'نظرة على وارِد.',
    'show.sub': 'كل شاشة مُصوَّرة بـ HTML و CSS حقيقي، بالضبط ما ستراه بعد التثبيت.',
    'show.rec.tag': 'الرئيسية',
    'show.rec.t': 'سجّل. شاهد النص يظهر.',
    'show.rec.d': 'زر دائري واحد. اضغط عليه أو استخدم الاختصار. يتدفق الناتج بينما يُظهر مؤشر النبض والموجة الصوتية أن وارِد يستمع.',
    'show.an.tag': 'التحليلات',
    'show.an.t': 'انظر كم تحدثت.',
    'show.an.d': 'وارِد يحسب كل كلمة تنسخها بصمت. يُظهر خريطة حرارية أيامك النشطة، شريط تقدم يتتبع الهدف التالي، وقائمة بأكثر كلماتك استخداماً.',
    'show.tpl.tag': 'الأوامر',
    'show.tpl.t': 'اختصار واحد لكل حالة.',
    'show.tpl.d': 'اجعل وارِد يفعل أكثر من النسخ. كل أمر يحمل موجّهه ولغة الإخراج والنموذج والاختصار العالمي الخاص به.',
    'show.set.tag': 'الإعدادات',
    'show.set.t': 'كل ما تتوقعه، لا شيء لا تريده.',
    'show.set.d': 'مفتاح Gemini الخاص بك مخزن في سلسلة مفاتيح نظام التشغيل. اختر نموذجاً، غيّر اللغة، بدّل السمة، قرر ما تنسخه تلقائياً.',
    'faq.label': 'الأسئلة',
    'faq.title': 'الأسئلة المتكررة.',
    'faq.q1': 'هل وارِد مجاني حقاً؟',
    'faq.a1': 'نعم. التطبيق مفتوح المصدر بموجب رخصة AGPLv3 ولا يكلف شيئاً. ستحتاج إلى مفتاح Google Gemini API مجاني، الذي تقدمه Google بطبقة مجانية سخية تكفي معظم الاستخدام الشخصي.',
    'faq.q2': 'أين يذهب صوتي؟',
    'faq.a2': 'مباشرة من جهازك إلى Gemini API من Google باستخدام مفتاحك الخاص. وارِد لا يملك خادماً. نحن لا نرى أو نسجل أو نخزن أي شيء. لا توجد أي تحليلات أو تتبع.',
    'faq.q3': 'ما اللغات التي يدعمها؟',
    'faq.a3': 'أي لغة يدعمها Gemini ستعمل، وهو يغطي تقريباً كل لغة رئيسية في العالم. العربية والإنجليزية تحظيان باهتمام خاص للتخطيط والتبديل بين اللغات، لكن يمكنك التحدث والحصول على مخرجات بأي لغة.',
    'faq.q4': 'هل يمكنني تشغيله بدون اتصال بالإنترنت؟',
    'faq.a4': 'يعمل التطبيق بدون إنترنت، لكن النسخ نفسه يرسل الصوت إلى Gemini الذي يتطلب اتصالاً بالإنترنت. وضع محلي بالكامل مخطط له مستقبلاً.',
    'faq.q5': 'لماذا أحتاج إلى مفتاح API الخاص بي؟',
    'faq.a5': 'حتى تبقى بياناتك لك ولا توجد حدود استخدام نفرضها نحن. مفتاحك يعيش في سلسلة مفاتيح نظام التشغيل. وارِد يقرأه فقط عند الحاجة لإجراء طلب.',
    'faq.q6': 'هل هو متاح في Microsoft Store أو Mac App Store؟',
    'faq.a6': 'ليس بعد. في الوقت الحالي، قم بتنزيل المثبّت لمنصتك من هذه الصفحة وشغّله. كلا الإصدارات الموقّعة وقوائم المتاجر مخططة.',
    'dl.label': 'تحميل',
    'dl.title': 'اختر منصتك.',
    'dl.sub': 'مجاني، مفتوح المصدر، ~10 ميغابايت. أضف مفتاح Gemini API وأنت جاهز.',
    'dl.win.title': 'ويندوز',
    'dl.win.cta': '<i data-lucide="download" stroke-width="1.75"></i> تحميل',
    'dl.win.req': 'ويندوز 10 أو أحدث · x64',
    'dl.mac.title': 'ماك',
    'dl.mac.cta': '<i data-lucide="download" stroke-width="1.75"></i> تحميل',
    'dl.mac.intel': '← إصدار Intel',
    'dl.mac.note': 'تطبيق غير موقَّع — يمنعه ماك عند أول تشغيل. لفتحه: شغِّل الأمر <code>xattr -cr /Applications/Warid.app</code> في الطرفية ثم افتح التطبيق. راجع README لإصدارات ماك الأخرى.',
    'dl.linux.title': 'لينكس',
    'dl.linux.cta': '<i data-lucide="download" stroke-width="1.75"></i> تحميل',
    'dl.linux.req': 'Ubuntu 22.04 · Debian · Fedora · amd64',
    'footer.copy': '© 2026 وارِد · مفتوح المصدر بموجب AGPLv3',
    'footer.gh': 'GitHub',
    'footer.releases': 'الإصدارات',
    'footer.issues': 'المشكلات',
    'footer.license': 'الرخصة',
    'mk.rec.frame': 'وارِد · الرئيسية',
    'mk.rec.ph': 'التسجيل',
    'mk.rec.chip': 'نسخ · <span class="kbd" style="margin-inline-start:4px;">Ctrl</span> <span class="kbd">Alt</span> <span class="kbd">R</span>',
    'mk.rec.elapsed': 'مضى',
    'mk.rec.wpm': 'ك/د',
    'mk.rec.words': 'كلمة',
    'mk.rec.text': 'أريد اليوم أن أضع خطة الإطلاق لتدفق الإعداد الجديد. الهدف الرئيسي هو تقليل الوقت حتى أول قيمة، لذا سنبدأ بتقليص شاشة الترحيب إلى خطوتين (اللغة ومفتاح API) وتأجيل كل شيء آخر حتى بعد أول تسجيل ناجح',
    'mk.rec.side': 'جارٍ التسجيل',
    'mk.rec.cancel': 'اضغط <span class="kbd">Esc</span> للإلغاء',
    'mk.an.frame': 'وارِد · الإحصائيات',
    'mk.an.ph': 'الإحصائيات',
    'mk.an.sessions': '147 جلسة',
    'mk.an.streak': '<i data-lucide="flame" stroke-width="1.75" style="width:12px;height:12px;"></i> سلسلة 12 يوماً',
    'mk.an.eyebrow': 'الكلمات المُنسَّخة',
    'mk.an.unit': 'كلمة',
    'mk.an.sub': '~51% للهدف التالي · 25,000 كلمة',
    'mk.an.m1': '5,000 · محقق',
    'mk.an.m2': '25,000 · ETA 12 يونيو',
    'mk.an.l1': 'وقت موفر مقارنةً بالكتابة',
    'mk.an.l2': 'السرعة الفعلية',
    'mk.an.l3': 'الإنجازات',
    'mk.an.hm': 'آخر 26 أسبوعاً',
    'mk.tpl.frame': 'وارِد · الأوامر',
    'mk.tpl.ph': 'الأوامر',
    'mk.tpl.active': '4 نشطة',
    'mk.tpl.new': '<i data-lucide="plus" stroke-width="1.75" style="width:12px;height:12px;"></i> جديد',
    'mk.tpl.i1': 'نسخ',
    'mk.tpl.i2': 'ترجمة وتنقيح',
    'mk.tpl.i3': 'مساعد برمجة',
    'mk.tpl.i4': 'تنسيق بريد',
    'mk.tpl.l.name': 'الاسم',
    'mk.tpl.l.prompt': 'الموجّه',
    'mk.tpl.l.out': 'الإخراج',
    'mk.tpl.l.model': 'النموذج',
    'mk.tpl.l.hotkey': 'الاختصار',
    'mk.tpl.v.name': 'ترجمة وتنقيح',
    'mk.tpl.v.prompt': 'ترجم الصوت إلى العربية. صحح القواعد وأزل كلمات الحشو وأنتج نسخة نظيفة واحترافية. احتفظ بنية المتحدث وأسلوبه.',
    'mk.tpl.v.out': 'العربية <i data-lucide="chevron-down" stroke-width="1.75" style="width:12px;height:12px;"></i>',
    'mk.set.frame': 'وارِد · الإعدادات',
    'mk.set.ph': 'الإعدادات',
    'mk.set.h1': 'مفاتيح API',
    'mk.set.h2': 'النموذج',
    'mk.set.h3': 'السلوك',
    'mk.set.h4': 'المظهر',
    'mk.set.openrouter': 'OpenRouter (اختياري)',
    'mk.set.notset': 'غير مُعيَّن',
    'mk.set.defmodel': 'النموذج الافتراضي',
    'mk.set.autocopy': 'نسخ المخرجات تلقائياً',
    'mk.set.history': 'حفظ النصوص في السجل',
    'mk.set.startup': 'تشغيل عند بدء النظام',
    'mk.set.theme.lbl': 'السمة',
    'mk.set.system': 'النظام',
    'mk.set.lang.lbl': 'لغة الواجهة',
  }
};

function applyTheme(theme) {
  const html = document.documentElement;
  const btn = document.getElementById('theme-btn');
  if (theme === 'dark') {
    html.classList.add('dark');
    btn.innerHTML = '<i data-lucide="sun" stroke-width="1.75"></i>';
  } else {
    html.classList.remove('dark');
    btn.innerHTML = '<i data-lucide="moon" stroke-width="1.75"></i>';
  }
  localStorage.setItem('warid_theme', theme);
  lucide.createIcons({ attrs: { 'stroke-width': '1.75' } });
}

function applyLang(lang) {
  const strings = STRINGS[lang] || STRINGS.en;
  document.documentElement.lang = lang;
  document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';

  document.querySelectorAll('[data-i18n]').forEach(function(el) {
    var key = el.getAttribute('data-i18n');
    var str = strings[key];
    if (str !== undefined) el.innerHTML = str;
  });

  document.querySelectorAll('.lang-pill button').forEach(function(btn) {
    btn.classList.toggle('is-active', btn.getAttribute('data-lang') === lang);
  });

  localStorage.setItem('warid_lang', lang);
  lucide.createIcons({ attrs: { 'stroke-width': '1.75' } });
}

(function init() {
  var savedTheme = localStorage.getItem('warid_theme') ||
    (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  applyTheme(savedTheme);

  var savedLang = localStorage.getItem('warid_lang') ||
    (navigator.language && navigator.language.startsWith('ar') ? 'ar' : 'en');
  applyLang(savedLang);

  document.querySelectorAll('.lang-pill button').forEach(function(btn) {
    btn.addEventListener('click', function() {
      applyLang(btn.getAttribute('data-lang'));
    });
  });

  document.getElementById('theme-btn').addEventListener('click', function() {
    var isDark = document.documentElement.classList.contains('dark');
    applyTheme(isDark ? 'light' : 'dark');
  });

  fetchRelease();
})();

function fetchRelease() {
  var CACHE_TTL = 30 * 60 * 1000; // 30 minutes
  var cached = sessionStorage.getItem('warid_release');
  if (cached) {
    try {
      var data = JSON.parse(cached);
      if (data && data.tag_name && Array.isArray(data.assets) && (Date.now() - (data._ts || 0)) < CACHE_TTL) {
        applyRelease(data);
        return;
      }
    } catch (e) { /* fall through to refetch */ }
  }

  fetch('https://api.github.com/repos/mohamedmaslooh/Warid/releases/latest', {
    headers: { 'Accept': 'application/vnd.github+json' },
    cache: 'no-store'
  })
    .then(function(r) {
      if (!r.ok) throw new Error('GitHub API ' + r.status);
      return r.json();
    })
    .then(function(data) {
      if (!data || !data.tag_name || !Array.isArray(data.assets)) {
        throw new Error('Malformed release payload');
      }
      sessionStorage.setItem('warid_release', JSON.stringify(Object.assign({ _ts: Date.now() }, data)));
      applyRelease(data);
    })
    .catch(function() {
      // Network error, rate limit, or malformed response: leave the static
      // /releases/latest hrefs in place so users still reach the newest release.
    });
}

function applyRelease(data) {
  var tag = data.tag_name || '';
  var assets = data.assets || [];

  // update version display
  document.querySelectorAll('.hero-version').forEach(function(el) { el.textContent = tag; });

  var urls = {};
  assets.forEach(function(a) {
    var n = a.name;
    if (/setup\.exe$/i.test(n))       urls.winExe = a.browser_download_url;
    else if (/\.msi$/i.test(n))       urls.winMsi = a.browser_download_url;
    else if (/aarch64\.dmg$/i.test(n)) urls.macArm = a.browser_download_url;
    else if (/x64\.dmg$/i.test(n))    urls.macIntel = a.browser_download_url;
    else if (/\.AppImage$/i.test(n))  urls.linuxAppImage = a.browser_download_url;
    else if (/\.deb$/i.test(n))       urls.linuxDeb = a.browser_download_url;
  });

  var fallback = 'https://github.com/MohamedMaslooh/Warid/releases/latest';

  var winBtn = document.querySelector('.dl-btn-win');
  if (winBtn) winBtn.href = urls.winExe || urls.winMsi || fallback;

  var macBtn = document.querySelector('.dl-btn-mac');
  if (macBtn) macBtn.href = urls.macArm || fallback;

  var macIntelLink = document.querySelector('.dl-mac-intel');
  if (macIntelLink && urls.macIntel) macIntelLink.href = urls.macIntel;

  var linuxBtn = document.querySelector('.dl-btn-linux');
  if (linuxBtn) linuxBtn.href = urls.linuxAppImage || urls.linuxDeb || fallback;
}

// Reveal animations on scroll
document.addEventListener('DOMContentLoaded', function() {
  var revealElements = document.querySelectorAll('.reveal');
  
  if ('IntersectionObserver' in window) {
    var revealObserver = new IntersectionObserver(function(entries, observer) {
      entries.forEach(function(entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('active');
          observer.unobserve(entry.target);
        }
      });
    }, {
      root: null,
      rootMargin: '0px',
      threshold: 0.1
    });

    revealElements.forEach(function(el) {
      revealObserver.observe(el);
    });
  } else {
    // Fallback for older browsers
    revealElements.forEach(function(el) {
      el.classList.add('active');
    });
  }
});

