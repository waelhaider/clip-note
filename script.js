// إشعار بسيط يختفي تلقائيًا
function showToast(message) {
  try {
    const el = document.createElement('div');
    el.className = 'toast';
    el.textContent = message;
    document.body.appendChild(el);
    // force reflow لتفعيل الانتقال
    void el.offsetWidth;
    el.style.opacity = '1';
    setTimeout(() => {
      el.style.opacity = '0';
      setTimeout(() => el.remove(), 200);
    }, 2000);
  } catch {}
}

// التحكم بحجم خط محرر الملاحظة وتخزينه
function getEditFontPx() {
  const prefs = safeLocalStorageGet('fontPrefs', {});
  return parseInt(prefs.edit || 20, 10);
}
function setEditFontPx(px) {
  const clamped = Math.max(10, Math.min(48, parseInt(px, 10) || 20));
  document.documentElement.style.setProperty('--edit-font-size', clamped + 'px');
  const prefs = safeLocalStorageGet('fontPrefs', {});
  prefs.edit = clamped;
  safeLocalStorageSet('fontPrefs', prefs);
}
function increaseEditFont() {
  try {
    const currentSize = getEditFontPx();
    const newSize = Math.min(48, currentSize + 1);
    setEditFontPx(newSize);

    console.log(`تم تكبير خط نافذة التحرير إلى ${newSize}px`);
    showToast(`تم تكبير الخط إلى ${newSize}px ✅`);
  } catch (error) {
    console.error('خطأ في تكبير الخط:', error);
    showToast('❌ خطأ في تكبير الخط');
  }
}

function decreaseEditFont() {
  try {
    const currentSize = getEditFontPx();
    const newSize = Math.max(10, currentSize - 1);
    setEditFontPx(newSize);

    console.log(`تم تصغير خط نافذة التحرير إلى ${newSize}px`);
    showToast(`تم تصغير الخط إلى ${newSize}px ✅`);
  } catch (error) {
    console.error('خطأ في تصغير الخط:', error);
    showToast('❌ خطأ في تصغير الخط');
  }
}
// --- دعم التراجع والإعادة أثناء تحرير الملاحظة ---
let editUndoStack = [];
let editRedoStack = [];

const editTextarea = () => document.getElementById("editTextarea");

function undoEditText() {
  if (editUndoStack.length > 0) {
    editRedoStack.push(editTextarea().innerHTML);
    const prev = editUndoStack.pop();
    editTextarea().innerHTML = prev;
  }
}

function redoEditText() {
  if (editRedoStack.length > 0) {
    editUndoStack.push(editTextarea().innerHTML);
    const next = editRedoStack.pop();
    editTextarea().innerHTML = next;
  }
}

// مراقبة التغييرات في textarea أثناء التحرير
function setupEditTextareaHistory() {
     editUndoStack = [];
     editRedoStack = [];
     const textarea = editTextarea();
     let lastValue = textarea.innerHTML;
     textarea.oninput = function() {
       editUndoStack.push(lastValue);
       lastValue = textarea.innerHTML;
       // عند أي إدخال جديد، امسح redoStack
       editRedoStack = [];

       // تحديث تموضع الصور في الملاحظات الأصلية
       updateImagePositionsInNotes();

       // تنسيق تلقائي للنص العربي والإنجليزي
       autoFormatTextDirection(textarea);
     };
   }
// قائمة نقل الملاحظة إلى لوحة أخرى
function toggleMoveMenu(button, index) {
  // إزالة أي قائمة نقل موجودة مسبقًا
  document.querySelectorAll('div[data-movemenu]').forEach(m => m.remove());

  // إنشاء قائمة النقل
  const moveMenuBox = document.createElement("div");
  moveMenuBox.setAttribute('data-movemenu', '1');
  moveMenuBox.classList.add('move-menu');
  moveMenuBox.style.width = '120px'; // عرض أقل للقائمة

  // أزرار النقل . كلمة نقل الى
  for (const tabId in tabNames) {
    if (tabId !== currentTab && tabId !== "trash" && tabId !== "settings") {
      const btn = document.createElement("button");
      btn.textContent = `إلى ${tabNames[tabId]}`;
      btn.onclick = function(e) {
        e.stopPropagation();
        moveNoteToTab(index, tabId);
        moveMenuBox.remove();
      };
      moveMenuBox.appendChild(btn);
    }
  }


  // أضف قائمة النقل إلى الجسم الرئيسي للصفحة لتظهر خارج الحاوية
  document.body.appendChild(moveMenuBox);
  moveMenuBox.style.position = 'fixed';
  moveMenuBox.style.left = '5px'; // وضعها على الجانب الأيسر لتكون ملاصقة للقائمة الرئيسية
  moveMenuBox.style.right = 'auto';

  // حساب موضع القائمة باستخدام getBoundingClientRect للدقة
  const btnRect = button.getBoundingClientRect();

  // عرض القائمة مؤقتًا لحساب ارتفاعها الفعلي
  moveMenuBox.style.visibility = 'hidden';
  moveMenuBox.style.display = 'block';
  const menuHeight = Math.min(moveMenuBox.offsetHeight, 300); // حد أقصى للارتفاع
  moveMenuBox.style.visibility = '';
  moveMenuBox.style.display = '';

  // حساب المساحة المتاحة
  const spaceBelow = window.innerHeight - btnRect.bottom;
  const spaceAbove = btnRect.top;

  let topPosition;

  // إذا كانت المساحة تحت الزر كافية، ضع القائمة هناك
  if (spaceBelow >= menuHeight) {
    topPosition = btnRect.bottom + 5; // مسافة صغيرة من الزر
  }
  // إذا كانت المساحة فوق الزر كافية، ضع القائمة هناك
  else if (spaceAbove >= menuHeight) {
    topPosition = btnRect.top - menuHeight - 5; // مسافة صغيرة من الزر
  }
  // إذا لم تكن المساحة كافية في أي مكان، ضع القائمة في أفضل موضع ممكن
  else {
    // ضع القائمة تحت الزر مع تمرير داخلي
    topPosition = btnRect.bottom + 5;

    // تأكد من أن القائمة لا تخرج من الشاشة
    const maxTop = window.innerHeight - menuHeight - 10;
    if (topPosition > maxTop) {
      topPosition = maxTop;
    }
  }

  moveMenuBox.style.top = topPosition + 'px';

  // إغلاق القائمة عند الضغط خارجها
  setTimeout(() => {
    function closeMenuOnClick(e) {
      if (!moveMenuBox.contains(e.target)) {
        moveMenuBox.remove();
        document.removeEventListener('mousedown', closeMenuOnClick);
      }
    }
    document.addEventListener('mousedown', closeMenuOnClick);
  }, 0);
}

  // حذف اللوحة الحالية مع حماية لوحة المحذوفات
function deleteCurrentTab() {
  if (currentTab === "trash" || currentTab === 'settings' || currentTab === 'home') {
    alert("❌ لا يمكن حذف المحذوفات أو الإعدادات أو الرئيسية.");
    return;
  }
    
    // طلب كتابة اسم اللوحة للتأكيد
    const currentTabName = tabNames[currentTab];
    const userInput = prompt(`⚠️ تحذير: سيتم حذف اللوحة "${currentTabName}" وجميع ملاحظاتها نهائياً!\n\nلتأكيد الحذف، اكتب اسم اللوحة بالضبط:\n"${currentTabName}"`);
    
    // التحقق من مطابقة الاسم المدخل
    if (userInput === null) {
      // المستخدم ضغط إلغاء
      return;
    }
    
    if (userInput.trim() !== currentTabName) {
      alert("❌ الاسم المدخل غير مطابق. تم إلغاء عملية الحذف.");
      return;
    }
    
    // حذف اسم اللوحة والملاحظات
    delete tabNames[currentTab];
    delete notes[currentTab];
    safeLocalStorageSet("tabNames", tabNames);
    safeLocalStorageSet("notes", notes);
    // تفعيل أول لوحة متاحة (عدا المحذوفة)
    const tabIds = Object.keys(tabNames).filter(id => id !== currentTab);
    const nextTab = tabIds.length > 0 ? tabIds[0] : "trash";
    renderTabs();
    switchTab(nextTab);
    alert("✅ تم حذف اللوحة بنجاح");
  }


// 🧠 تهيئة البيانات من التخزين المحلي لوكال أو إنشاؤها لأول مرة
if (!localStorage.getItem("notes") || !localStorage.getItem("tabNames")) {
  localStorage.setItem("notes", JSON.stringify({
    "home": [], "trash": []
  }));
  localStorage.setItem("tabNames", JSON.stringify({
    "home": "الرئيسية", "settings": "اعدادات", "trash": "المحذوفات"
  }));
}

// إصلاح مشكلة Firefox مع localStorage
try {
  // محاولة كتابة وقراءة بسيطة للتأكد من عمل localStorage
  localStorage.setItem('test', 'test');
  localStorage.removeItem('test');
} catch (e) {
  console.warn('localStorage غير متاح، قد تكون في وضع التصفح الخفي أو متصفح قديم');
  // في حالة عدم توفر localStorage، سنستخدم متغيرات عامة كبديل
  window.fallbackStorage = {
    notes: JSON.parse(JSON.stringify({
      "home": [], "trash": []
    })),
    tabNames: JSON.parse(JSON.stringify({
      "home": "الرئيسية", "settings": "اعدادات", "trash": "المحذوفات"
    }))
  };
}

let notes, tabNames, currentTab = "home";

// دالة آمنة للوصول إلى localStorage
function safeLocalStorageGet(key, defaultValue) {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : defaultValue;
  } catch (e) {
    console.warn(`فشل في قراءة ${key} من localStorage:`, e);
    return window.fallbackStorage ? window.fallbackStorage[key] : defaultValue;
  }
}

// دالة آمنة لحفظ في localStorage
function safeLocalStorageSet(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    // تحديث البيانات الاحتياطية إذا كانت متوفرة
    if (window.fallbackStorage) {
      window.fallbackStorage[key] = JSON.parse(JSON.stringify(value));
    }
  } catch (e) {
    console.warn(`فشل في حفظ ${key} في localStorage:`, e);
    // حفظ في الذاكرة كبديل
    if (window.fallbackStorage) {
      window.fallbackStorage[key] = JSON.parse(JSON.stringify(value));
    }
  }
}

notes = safeLocalStorageGet("notes", { "home": [], "trash": [] });
tabNames = safeLocalStorageGet("tabNames", { "home": "الرئيسية", "settings": "اعدادات", "trash": "المحذوفات" });

// تأكد من وجود لوحة المحذوفات دائمًا في البيانات
if (!tabNames["trash"]) {
  tabNames["trash"] = "المحذوفات";
  notes["trash"] = [];
  safeLocalStorageSet("tabNames", tabNames);
  safeLocalStorageSet("notes", notes);
}

// تأكد من وجود تبويب الرئيسية دائمًا
if (!tabNames["home"]) {
  tabNames["home"] = "الرئيسية";
  if (!notes["home"]) notes["home"] = [];
  safeLocalStorageSet("tabNames", tabNames);
  safeLocalStorageSet("notes", notes);
}

// تأكد من وجود تبويب الاعدادات قبل المحذوفات
if (!tabNames["settings"]) {
  tabNames["settings"] = "اعدادات";
  safeLocalStorageSet("tabNames", tabNames);
}

// 🧩 عرض ازرار التبويبات في الأعلى
function renderTabs() {
  const tabContainer = document.getElementById("tabContainer");
  tabContainer.innerHTML = "";

  let firstTabId = null;

  // أنشئ حاوية داخلية للتمرير للتبويبات فقط
  const scrollWrap = document.createElement('div');
  scrollWrap.className = 'tabs-scroll';

  // ترتيب خاص: الرئيسية ثم التبويبات العادية (مع إخفاء المحذوفات) ثم الإعدادات
  const normalKeys = Object.keys(tabNames).filter(id => id !== 'trash' && id !== 'settings' && id !== 'home');
  normalKeys.sort();
  const ordered = ['home', ...normalKeys].filter(k => tabNames[k]);

  ordered.forEach((key, idx) => {
    if (!firstTabId) firstTabId = key;
    const btn = document.createElement("button");
    btn.className = "tab-btn";
    btn.dataset.tab = key;
    btn.textContent = tabNames[key];
    btn.onclick = () => switchTab(key);
    scrollWrap.appendChild(btn);
  });

  // زر الإعدادات خارج منطقة التمرير
  const settingsBtn = document.createElement('button');
  settingsBtn.className = 'tab-btn settings-tab';
  settingsBtn.dataset.tab = 'settings';
  settingsBtn.textContent = '🛡️'; // أيقونة ترس بدل النص🛠️/🛡️⚙️
  settingsBtn.title = 'إعدادات';
                                            // حجم زر اعدادات
  settingsBtn.style.padding = '1px 3px'; // هنا حجم مربع زر الاعدادات,الحشوة
  settingsBtn.style.fontSize = '11px'; // هنا حجم مربع زر الاعدادات
  settingsBtn.style.lineHeight = '1'; // هنا حجم مربع زر الاعدادات
  settingsBtn.style.minWidth = 'auto'; // هنا حجم مربع زر الاعدادات
  settingsBtn.style.height = '30px'; // هنا حجم مربع زر الاعدادات,الارتفاع
  settingsBtn.onclick = (e) => { e.stopPropagation(); toggleSettingsMenu(settingsBtn); };

  tabContainer.appendChild(scrollWrap);
  tabContainer.appendChild(settingsBtn);
return firstTabId;
}

// 🔄 تغيير التبويب عند الضغط
function switchTab(tabId) {
// تحديث التاب
  currentTab = tabId;
  // إزالة التمييز من كل الأزرار
  document.querySelectorAll(".tab-btn").forEach(btn => {
    btn.classList.remove("active");
  });
  // تمييز الزر النشط
  const activeBtn = document.querySelector(`.tab-btn[data-tab="${tabId}"]`);
  if (activeBtn) activeBtn.classList.add("active");
  // عرض الملاحظات الخاصة بالتبويب
  renderNotes();
}
// 🎯 تمييز التبويب النشط بصريًا
function updateActiveFirstTab() {
  document.querySelectorAll(".tab-btn").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.tab === currentTab);
  });
}
// تفعيل أول تبويب تلقائيًا عند تحميل الصفحة
function activateFirstTab() {
  const firstTab = document.querySelector(".tab-btn");
  if (firstTab) {
    const tabId = firstTab.getAttribute("data-tab");
    switchTab(tabId); // يعرض الملاحظات ويُفعّل الزر
  }
}


// 🧩 رندر نوت         ازرار نسخ,تحرير,حذف,نقل 

function renderNotes() {
  const container = document.getElementById("notesContainer");
  container.innerHTML = "";
  if (!notes[currentTab]) notes[currentTab] = [];

  notes[currentTab].forEach((item, index) => {
    let text = item;
    let from = null;
    let createdAt = null;
    // إذا كنا في المحذوفات، العنصر كائن
    if (currentTab === "trash" && typeof item === "object" && item !== null) {
      text = item.text;
      from = item.from;
      createdAt = item.createdAt || null;
    }
    // في اللوحات العادية: قد تكون الملاحظة نصًا خامًا أو كائنًا
    if (currentTab !== "trash" && typeof item === "object" && item !== null) {
      text = item.text;
      createdAt = item.createdAt || null;
    }
    const div = document.createElement("div");   
 
                // (تقليل الهامش بين الملاحظات mb)(pt=المسافة بين النص وأعلى الملاحظة من جوا
    div.className = "note-box relative bg-white border shadow-sm pt-2 mb-1 rounded"; 
    div.style.display = "flex";
    div.style.flexDirection = "column";

    // إنشاء العناصر يدويًا
    const span = document.createElement("span");
    span.className = "note-preview break-words";

    // التحقق من وجود تموضع محفوظ للصور في هذه الملاحظة
    let modifiedText = text;
    if (typeof item === "object" && item.imagePositions) {
      // تطبيق تموضع الصور المحفوظ
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = text;

      const images = tempDiv.querySelectorAll('img');
      images.forEach(img => {
        const imgSrc = img.src;
        if (item.imagePositions[imgSrc]) {
          const positionInfo = item.imagePositions[imgSrc];
          img.className = positionInfo.class || 'inline';

          // تطبيق التموضع المطلق إذا كان موجوداً
          if (positionInfo.position) {
            if (img.className.includes('position-absolute') && !img.className.includes('position-top') && !img.className.includes('position-bottom')) {
              img.style.top = positionInfo.position.top + 'px';
              img.style.left = positionInfo.position.left + 'px';
            }
          }
        }
      });

      modifiedText = tempDiv.innerHTML;
    }

    span.innerHTML = modifiedText; // استخدام innerHTML لعرض الصور بدلاً من textContent
    span.onclick = () => {
      span.classList.toggle("expanded");
    };

    // مكان كلمة منقول من في المحذوفات
    if (currentTab === "trash" && from) {
      const fromDiv = document.createElement("div");
      fromDiv.style.fontSize = "12px";
      fromDiv.style.color = "#888";
      fromDiv.style.marginTop = "4px";
      fromDiv.textContent = `من : ${from}`;
      span.appendChild(fromDiv);
    }

    // سطر معلومات الوقت تحت كل ملاحظة

    const meta = document.createElement("div");
meta.className = "note-meta";

if (createdAt) {
  try {
    const d = new Date(createdAt);

    const parts = new Intl.DateTimeFormat('en-US', {
      calendar: 'gregory',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    }).formatToParts(d);

    // استخراج الأجزاء
    const day = parts.find(p => p.type === 'day')?.value;
    const month = parts.find(p => p.type === 'month')?.value;
    const year = parts.find(p => p.type === 'year')?.value;
    const hour = parts.find(p => p.type === 'hour')?.value;
    const minute = parts.find(p => p.type === 'minute')?.value;
    const dayPeriod = parts.find(p => p.type === 'dayPeriod')?.value;

    // تنسيق مخصص: اليوم/الشهر/السنة 🕒 الساعة:الدقيقة
    const dateStr = `${day}/${month}/${year}🕒${hour}:${minute} ${dayPeriod}`;

    meta.textContent = ` ${dateStr}`;
  } catch {
    meta.textContent = "";
  }
}
     

    const menuContainer = document.createElement("div");
    menuContainer.className = "relative";
    // لا حاجة لهوامش أو تخطيطات لأن الزر متموضع مطلقًا عبر CSS
    menuContainer.style.marginTop = "0";
    menuContainer.style.display = "";
    menuContainer.style.justifyContent = "";

    const menuToggle = document.createElement("button");
    menuToggle.className = "menu-toggle"; // تقريب الزر من الحافة، إزالة الهوامش الجانبية
    menuToggle.textContent = "📋";
    menuToggle.addEventListener("click", function(e) {
      e.stopPropagation();
      toggleMenu(menuToggle);
    });

    const menu = document.createElement("div");
    menu.className = "menu hidden absolute left-full top-0 bg-white border rounded-lg shadow-lg z-1";

    // زر نسخ
    const copyBtn = document.createElement("button");
    copyBtn.className = "block w-full text-right px-3 py-2 hover:bg-gray-100";
    copyBtn.textContent = "📄 نسخ";
    copyBtn.addEventListener("click", function(e) {
      e.stopPropagation();
      copyText(index);
      menu.classList.add("hidden");
    });

    // زر تحرير
    const editBtn = document.createElement("button");
    editBtn.className = "block w-full text-right px-3 py-2 hover:bg-gray-100";
    editBtn.textContent = "✏️ تحرير";
    editBtn.addEventListener("click", function(e) {
      e.stopPropagation();
      openEditModal(index);
      menu.classList.add("hidden");
    });

    // زر حذف
    const deleteBtn = document.createElement("button");
    deleteBtn.className = "block w-full text-right px-3 py-2 text-red-600 hover:bg-red-100";
    deleteBtn.textContent = "🗑️ حذف";
    deleteBtn.addEventListener("click", function(e) {
      e.stopPropagation();
      deleteText(index);
      menu.classList.add("hidden");
    });

    // زر نقل
    const moveDiv = document.createElement("div");
    moveDiv.className = "relative";
    const moveBtn = document.createElement("button");
    moveBtn.className = "block w-full text-left px-3 py-2 hover:bg-gray-100";
    moveBtn.textContent = "📦 نقل";
    moveBtn.addEventListener("click", function(e) {
      e.stopPropagation();
      e.preventDefault();
      toggleMoveMenu(moveBtn, index);
    });
    moveDiv.appendChild(moveBtn);

    // تجميع القائمة
    menu.appendChild(copyBtn);
    menu.appendChild(editBtn);
    menu.appendChild(deleteBtn);
    menu.appendChild(moveDiv);

    menuContainer.appendChild(menuToggle);
    menuContainer.appendChild(menu);

    div.appendChild(span);
    if (meta.textContent) {
      div.appendChild(meta);
    }

    // ضبط الحشوة السفلية ديناميكيًا بحسب عدد الأسطر المعروضة (1..3)
    // حتى لا يظهر فراغ زائد في حالة سطر واحد
    requestAnimationFrame(() => {
      try {
        const computed = window.getComputedStyle(span);
        const lineHeightPx = parseFloat(computed.lineHeight);
        const heightPx = span.getBoundingClientRect().height;
        if (lineHeightPx > 0) {
          const linesShown = Math.round(heightPx / lineHeightPx);
          // محاذاة متوازنة: 8px لسطر/سطرين (تساوي العلوية)، و24px عند 3 أسطر لإتاحة مكان للزر
          if (linesShown < 3) {
            div.style.paddingBottom = "4px";
          } else {
            div.style.paddingBottom = "5px"; //المسافة بين النص وسفل الملاحظة من جوا
          }
        }
      } catch {}
    });

    div.appendChild(menuContainer);
    container.appendChild(div);
  });
}

//حفظ الملاحظة الجديدة
function saveNewNote() {
  const input = document.getElementById("newNoteInput");
  const content = input.innerHTML.trim();
  if (content) {
    const noteObj = { text: content, createdAt: new Date().toISOString() };
    notes[currentTab].unshift(noteObj); // أضف الملاحظة في البداية
    safeLocalStorageSet("notes", notes);
    renderNotes();
    input.innerHTML = "";
  }
}

// دعم الضغط على Enter لإضافة سطر جديد
function setupInputEnterKey() {
  const input = document.getElementById("newNoteInput");
  if (input) {
    input.addEventListener("keydown", function(e) {
      if (e.key === "Enter" && !e.shiftKey) {
        // السماح بسلوك Enter الافتراضي (إضافة سطر جديد)
        // لا نحتاج لمنع الحدث الافتراضي
        return;
      }
    });
  }
}

// 📄 نسخ النص إلى الحافظة
function copyText(index) {
  const noteItem = notes[currentTab][index];
  let text = (noteItem && typeof noteItem === "object") ? (noteItem.text || "") : noteItem;

  // إزالة علامات HTML للنسخ النصي فقط
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = text;
  text = tempDiv.textContent || tempDiv.innerText || "";

  navigator.clipboard.writeText(text || "");
  showToast("تم نسخ النص ✅");
}

// 🗑️ حذف النص من اللوحة
function deleteText(index) {
  if (currentTab === "trash") {
    // حذف نهائي من المحذوفات
    if (confirm("⚠️ سيتم حذف هذا النص نهائيًا من المحذوفات. هل أنت متأكد؟")) {
      const deletedObj = notes[currentTab][index];
      notes[currentTab].splice(index, 1);
      undoStack.push({
        type: "delete",
        tabId: currentTab,
        text: deletedObj,
        index: index
      });
      redoStack = [];
      safeLocalStorageSet("notes", notes);
      renderNotes();
    }
    return;
  }
  // نقل إلى المحذوفات مع حفظ اسم اللوحة الأصلية
  if (confirm("هل تريد نقل هذا النص إلى المحذوفات؟")) {
    const originalNote = notes[currentTab][index];
    const deletedText = (typeof originalNote === "object" && originalNote !== null) ? originalNote.text : originalNote;
    const trashFrom = tabNames[currentTab];
    const trashObj = {
      text: deletedText,
      from: trashFrom,
      createdAt: (typeof originalNote === "object" && originalNote !== null) ? originalNote.createdAt : undefined
    };
    notes["trash"].unshift(trashObj);
    notes[currentTab].splice(index, 1);
    undoStack.push({
      type: "delete",
      tabId: currentTab,
      text: deletedText,
      index: index,
      movedToTrash: true,
      trashFrom: trashFrom,
      originalNote: originalNote
    });
    redoStack = [];
    safeLocalStorageSet("notes", notes);
    renderNotes();
  }
}
// 📋 فتح أو إغلاق قائمة الخيارات الزر الصغير 
function toggleMenu(button) {
  const menu = button.nextElementSibling;
  document.querySelectorAll(".menu").forEach(m => {
    if (m !== menu) m.classList.add("hidden");
  });
  menu.classList.toggle("hidden");

  // إذا أصبحت القائمة ظاهرة، تحقق من موضعها
  if (!menu.classList.contains("hidden")) {
    menu.style.position = 'fixed';
    const btnRect = button.getBoundingClientRect();
    menu.style.right = '';
    menu.style.left = btnRect.left + 'px';
    // أظهر القائمة مؤقتًا لحساب ارتفاعها
    menu.style.visibility = 'hidden';
    menu.style.display = 'block';
    // ...existing code...
    menu.style.display = '';
    menu.style.visibility = '';
    // حساب المساحة المتاحة فوق وتحت الزر
    const spaceBelow = window.innerHeight - btnRect.bottom;
    const spaceAbove = btnRect.top;
    const menuHeight = menu.offsetHeight;
    if (spaceBelow >= menuHeight) {
      menu.style.top = btnRect.bottom + 'px';
    } else if (spaceAbove >= menuHeight) {
      menu.style.top = (btnRect.top - menuHeight) + 'px';
    } else if (spaceBelow >= spaceAbove) {
      menu.style.top = (window.innerHeight - menuHeight - 8) + 'px';
    } else {
      menu.style.top = '8px';
    }
  }
  // ...existing code...
}

// 🌙 تبديل الوضع الليلي
function toggleNightMode() {
  const body = document.body;
  const isNightMode = body.classList.contains('night');
  
  if (isNightMode) {
    body.classList.remove('night');
    safeLocalStorageSet('nightMode', 'false');
  } else {
    body.classList.add('night');
    safeLocalStorageSet('nightMode', 'true');
  }
}

// قائمة إعدادات منسدلة تضم: تصدير، استيراد، إضافة لوحة، تعديل اسم، حذف
function toggleSettingsMenu(anchorBtn) {
  // أغلق أي قوائم مفتوحة أخرى
  document.querySelectorAll('.menu').forEach(m => m.classList.add('hidden'));
  // إذا كانت موجودة سابقًا، احذفها ليصبح لدينا نسخة واحدة فقط
  const existing = document.querySelector('#settingsMenu');
  if (existing) existing.remove();

  const menu = document.createElement('div');
  menu.id = 'settingsMenu';
  menu.className = 'menu';
  menu.style.position = 'fixed';

  function addItem(label, onClick) {
    const b = document.createElement('button');
    b.className = 'block w-full text-right px-3 py-2 hover:bg-gray-100';
    b.textContent = label;
    b.onclick = (e) => { e.stopPropagation(); onClick(); menu.remove(); };
    menu.appendChild(b);
  }

  // فتح المحذوفات في أعلى القائمة
  addItem('🗑️المحذوفات', () => switchTab('trash'));
  addItem('📤 تصدير', exportNotes);
  addItem('📥 استيراد', importNotes);
  addItem('📄استيراد نص', importFromText); // استيراد من ملف نصي عادي
  addItem('➕إضافة لوحة', addNewTab);
  addItem('✏️تعديل لوحة', renameCurrentTab);
  addItem('🌙 وضع ليلي', toggleNightMode);
  addItem('🗑️حذف لوحة', deleteCurrentTab);

  // زر حجم النص يفتح قائمة فرعية فيها + و - لكل نوع
  
  const fontBtn = document.createElement('button');
  fontBtn.className = 'font-size-btn block w-full text-center';
  fontBtn.textContent = 'حجم النص';
  const fontMenu = document.createElement('div');
  fontMenu.className = 'menu';
  fontMenu.style.position = 'fixed';
  fontMenu.style.display = 'none';

  function getCurrentPx(key, fallback) {
    const prefs = safeLocalStorageGet('fontPrefs', {});
    const v = prefs[key] || fallback;
    return parseInt(v, 10);
  }
  function setPx(key, px) {
    const prefs = safeLocalStorageGet('fontPrefs', {});
    prefs[key] = px;
    safeLocalStorageSet('fontPrefs', prefs);
    if (key === 'input') document.documentElement.style.setProperty('--input-font-size', px + 'px');
    if (key === 'note') document.documentElement.style.setProperty('--note-font-size', px + 'px');
    if (key === 'edit') document.documentElement.style.setProperty('--edit-font-size', px + 'px');
    if (key === 'tab') {
      document.documentElement.style.setProperty('--tab-font-size', px + 'px');
      console.log(`تم تطبيق --tab-font-size: ${px}px`);
    }
  }
  function makeRow(label, key, fallbackPx) {
    const row = document.createElement('div');
    row.style.display = 'flex';
    row.style.alignItems = 'center';
    row.style.justifyContent = 'space-between';
    row.style.gap = '6px';     // أبعاد مربع يحوي تكبير (ادخال,الملاحظات,اسم اللوحة
    row.style.padding = '1px 1px'; // تباعد عمودي بين كلمات (ادخال الملاحظات,اسم اللوحة

    const title = document.createElement('div');
    title.textContent = label;
    title.style.fontSize = '14px';    //حجم خط (ادخال الملاحظات,اسم اللوحة
    title.style.padding = '5px 5px';  //تباعد عمودي بين مربعات الزائد والناقص
    row.appendChild(title);

    const controls = document.createElement('div');
    controls.style.display = 'flex';
    controls.style.gap = '4px'; // تقريب مربعي + و - افقيا

    const minus = document.createElement('button');
    minus.textContent = '−';
    minus.style.padding = '4px 10px';
    minus.style.border = '1px solid #ccc';
    minus.style.borderRadius = '4px';
minus.style.fontSize = '20px'; // حجم الناقص
    minus.onclick = (e) => {
      e.stopPropagation();
      const current = getCurrentPx(key, fallbackPx);
      const next = Math.max(8, current - 1);
      setPx(key, next);
      console.log(`تم تقليل حجم ${key} إلى ${next}px`);
    };

    const plus = document.createElement('button');
    plus.textContent = '+';
    plus.style.padding = '4px 10px';
    plus.style.border = '1px solid #ccc';
    plus.style.borderRadius = '4px';
 plus.style.fontSize = '20px'; // حجم الزائد
    plus.onclick = (e) => {
      e.stopPropagation();
      const current = getCurrentPx(key, fallbackPx);
      const next = Math.min(40, current + 1);
      setPx(key, next);
      console.log(`تم زيادة حجم ${key} إلى ${next}px`);
    };

    controls.appendChild(plus);
    controls.appendChild(minus);
    row.appendChild(controls);
    fontMenu.appendChild(row);
  }

  makeRow('الإدخال', 'input', 14);
  makeRow('الملاحظات', 'note', 13);
  makeRow('إسم اللوحة', 'tab', 14);

  fontBtn.onclick = (e) => {
    e.stopPropagation();
    const r = fontBtn.getBoundingClientRect();
    fontMenu.style.left = r.left + 'px';
    fontMenu.style.top = (r.bottom + 10) + 'px';  // انزياح قائمة محتويات حجم النص لتحت
    fontMenu.style.display = (fontMenu.style.display === 'none') ? 'block' : 'none';
  };

  // تطبيق تفضيلات الخط المحفوظة عند فتح القائمة لأول مرة
  (function applySavedFonts() {
    try {
      const prefs = safeLocalStorageGet('fontPrefs', {});
      if (prefs.input) document.documentElement.style.setProperty('--input-font-size', prefs.input + 'px');
      if (prefs.note) document.documentElement.style.setProperty('--note-font-size', prefs.note + 'px');
      if (prefs.edit) document.documentElement.style.setProperty('--edit-font-size', prefs.edit + 'px');
      if (prefs.tab) document.documentElement.style.setProperty('--tab-font-size', prefs.tab + 'px');
    } catch {}
  })();

  menu.appendChild(fontBtn);
  document.body.appendChild(menu);
  document.body.appendChild(fontMenu);

  document.body.appendChild(menu);
  const rect = anchorBtn.getBoundingClientRect();
  menu.style.left = rect.left + 'px';
  menu.style.top = (rect.bottom + 6) + 'px';

  // اغلاق عند النقر خارج
  setTimeout(() => {
    function onDoc(e) {
      if (!menu.contains(e.target)) {
        menu.remove();
        document.removeEventListener('mousedown', onDoc);
      }
    }
    document.addEventListener('mousedown', onDoc);
  }, 0);
}

// العثور على معرف لوحة بالاسم أو إنشاؤها إن لم توجد
function findOrCreateTabByName(name) {
  // ابحث عن اسم مطابق
  for (const id in tabNames) {
    if (tabNames[id] === name) return id;
  }
  // لا تنشئ لوحات خاصة
  if (name === 'المحذوفات' || name === 'اعدادات') return null;
  // أنشئ معرفًا جديدًا
  let newId = 1;
  while (tabNames.hasOwnProperty(String(newId))) newId++;
  newId = String(newId);
  tabNames[newId] = name;
  notes[newId] = [];
  safeLocalStorageSet('tabNames', tabNames);
  safeLocalStorageSet('notes', notes);
  renderTabs();
  return newId;
}

// استيراد من ملف نصي بصيغة: سطر عنوان لوحة بين أقواس [اسم اللوحة] ثم ملاحظات تفصلها أسطر فارغة
function importFromText() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.txt';
  input.onchange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const text = String(reader.result || '');
        const lines = text.split(/\r?\n/);
        let currentTabName = null;
        let currentTabId = null;
        let buffer = [];

        function flushNote() {
          const content = buffer.join('\n').trim();
          if (!content) return;
          const noteObj = { text: content, createdAt: new Date().toISOString() };
          if (!currentTabId) {
            // إن لم يحدد تبويب بعد، ضعها في اللوحة الحالية
            currentTabId = currentTab;
          }
          if (!notes[currentTabId]) notes[currentTabId] = [];
          notes[currentTabId].push(noteObj); // نحافظ على ترتيب الملف من الأعلى للأسفل
          buffer = [];
        }

        for (let raw of lines) {
          const line = raw;
          const m = line.match(/^\s*\[(.+?)\]\s*$/);
          if (m) {
            // عنوان لوحة
            flushNote();
            currentTabName = m[1].trim();
            currentTabId = findOrCreateTabByName(currentTabName);
            continue;
          }
          if (/^\s*$/.test(line)) {
            // سطر فارغ يفصل الملاحظات
            flushNote();
          } else {
            buffer.push(line);
          }
        }
        // آخر ملاحظة
        flushNote();

        safeLocalStorageSet('notes', notes);
        safeLocalStorageSet('tabNames', tabNames);
        renderTabs();
        // بعد الاستيراد، اعرض أول لوحة عادية إن وجدت
        const firstTab = Object.keys(tabNames).find(id => id !== 'settings' && id !== 'trash');
        if (firstTab) switchTab(firstTab);
        renderNotes();
        alert('✅ تم استيراد النصوص من الملف النصي وتوزيعها على التبويبات');
      } catch (err) {
        alert('❌ تعذر قراءة الملف النصي');
        console.error(err);
      }
    };
    reader.readAsText(file);
  };
  input.click();
}

//                        تنفيذ نقل الملاحظة   
function moveNoteToTab(index, targetTabId) {
  let note = notes[currentTab][index];
  // إذا كنا في المحذوفات والملاحظة كائن، ننقل النص فقط
  if (currentTab === "trash" && typeof note === "object" && note !== null && note.text) {
    note = note.text;
  }
  notes[targetTabId].unshift(note);
  notes[currentTab].splice(index, 1);
  undoStack.push({
    type: "move",
    fromTab: currentTab,
    toTab: targetTabId,
    text: note,
    index: index
  });
  // عند أي عملية جديدة، امسح redoStack
  redoStack = [];
  safeLocalStorageSet("notes", notes);
  renderNotes();
}


//نافذة تحرير النص المنبثقة 
// 📝 متغير لتخزين رقم النص الجاري تحريره
let editingIndex = null;
// متغير لتخزين النص الأصلي أثناء التحرير
let originalNoteContent = null;

// ✏️ فتح نافذة التحرير بالنص الكامل
function openEditModal(index) {
  editingIndex = index;
  let value = notes[currentTab][index];
  if (typeof value === "object" && value !== null) {
    value = value.text || "";
  }

  // حفظ النص الأصلي (مع الصور)
  originalNoteContent = value;

  // عرض المحتوى الكامل مع الصور
  const editTextarea = document.getElementById("editTextarea");
  if (editTextarea) {
    editTextarea.innerHTML = value;
    // تطبيق التنسيق التلقائي عند فتح النافذة
    autoFormatTextDirection(editTextarea);
  }
  document.getElementById("editModal").classList.remove("hidden");
  isEditModalOpen = true;
  setupEditTextareaHistory();

  // جعل الصور قابلة للسحب والإفلات
  setTimeout(() => {
    makeImagesDraggable();
    // تحديث تنسيق الصور بعد فتح النافذة
    updateImageStyles();
  }, 100); // تأخير لضمان تحميل DOM
}
// ❌ إغلاق نافذة التحرير
function closeEditModal() {
  const editModal = document.getElementById("editModal");
  if (editModal) {
    editModal.classList.add("hidden");
  }
  isEditModalOpen = false;
  editingIndex = null;
  originalNoteContent = null; // مسح النص الأصلي عند الإغلاق

  // إزالة التحديد من جميع الصور
  const images = document.querySelectorAll('#editTextarea img');
  images.forEach(img => {
    img.style.outline = 'none';
    img.style.boxShadow = '';
  });
}
// 💾 حفظ التعديل وتحديث اللوحة
function saveEditedText() {
  try {
    // التحقق من أن نافذة التحرير مفتوحة
    if (!isEditModalOpen) {
      console.error('نافذة التحرير مغلقة');
      showToast('❌ نافذة التحرير مغلقة');
      return;
    }

    const editTextarea = document.getElementById("editTextarea");
    if (!editTextarea) {
      console.error('لم يتم العثور على editTextarea');
      showToast('❌ خطأ في العثور على منطقة التحرير');
      return;
    }

    const newContent = editTextarea.innerHTML.trim();
    if (!newContent) {
      console.error('المحتوى فارغ');
      showToast('❌ لا يوجد محتوى لحفظه');
      return;
    }

    if (editingIndex === null || editingIndex < 0) {
      console.error('editingIndex غير صالح:', editingIndex);
      showToast('❌ خطأ في فهرس الملاحظة');
      return;
    }

    // حفظ المحتوى في الملاحظة
    const item = notes[currentTab][editingIndex];
    if (item && typeof item === "object") {
      item.text = newContent;
      item.lastModified = new Date().toISOString();
    } else {
      notes[currentTab][editingIndex] = {
        text: newContent,
        createdAt: new Date().toISOString(),
        lastModified: new Date().toISOString()
      };
    }

    // حفظ تموضع الصور في نافذة التحرير
    if (editTextarea) {
      const images = editTextarea.querySelectorAll('img');
      editModalImagePositions = {};
      images.forEach((img, index) => {
        editModalImagePositions[img.src] = {
          class: img.className,
          index: index
        };
      });
    }

    // تم حفظ التغييرات في الملاحظات الأصلية

    // حفظ في localStorage
    safeLocalStorageSet("notes", notes);

    // تحديث عرض الملاحظات
    renderNotes();

    // إغلاق نافذة التحرير
    closeEditModal();

    showToast('تم حفظ التعديلات ✅');
    console.log('تم حفظ التعديلات بنجاح');

  } catch (error) {
    console.error('خطأ في حفظ التعديلات:', error);
    showToast('❌ خطأ في حفظ التعديلات: ' + error.message);
  }
}
//                     التراجع والاعادة
let undoStack = [];
let redoStack = [];

function undoNote() {
  const last = undoStack.pop();
  if (!last) return;

  if (last.type === "move") {
    // ...نفس منطق النقل...
    const targetNotes = notes[last.toTab];
    const movedIndex = targetNotes.indexOf(last.text);
    if (movedIndex !== -1) targetNotes.splice(movedIndex, 1);
    if (!notes[last.fromTab]) notes[last.fromTab] = [];
    notes[last.fromTab].splice(last.index, 0, last.text);
    redoStack.push(last);
    currentTab = last.fromTab;
    renderTabs();
    switchTab(currentTab);
    safeLocalStorageSet("notes", notes);
  } else if (last.type === "delete") {
    // استرجاع النص المحذوف
    if (last.movedToTrash) {
      // أزل النسخة من المحذوفات أولاً
      const trashList = notes["trash"] || [];
      const removeIndex = trashList.findIndex(function(item) {
        if (!(item && typeof item === "object")) return false;
        const sameText = item.text === last.text;
        const sameFrom = item.from === last.trashFrom;
        const sameCreated = (last.originalNote && last.originalNote.createdAt) ? item.createdAt === last.originalNote.createdAt : true;
        return sameText && sameFrom && sameCreated;
      });
      if (removeIndex !== -1) {
        trashList.splice(removeIndex, 1);
      }
    }
    if (!notes[last.tabId]) notes[last.tabId] = [];
    const noteToRestore = (last.originalNote !== undefined) ? last.originalNote : last.text;
    notes[last.tabId].splice(last.index, 0, noteToRestore);
    redoStack.push(last);
    currentTab = last.tabId;
    renderTabs();
    switchTab(currentTab);
    safeLocalStorageSet("notes", notes);
  }
}


function redoNote() {
  const redoAction = redoStack.pop();
  if (!redoAction) return;

  if (redoAction.type === "move") {
    // ...نفس منطق النقل...
    if (!notes[redoAction.fromTab]) notes[redoAction.fromTab] = [];
    const idx = notes[redoAction.fromTab].indexOf(redoAction.text);
    if (idx !== -1) notes[redoAction.fromTab].splice(idx, 1);
    if (!notes[redoAction.toTab]) notes[redoAction.toTab] = [];
    notes[redoAction.toTab].push(redoAction.text);
    undoStack.push(redoAction);
    currentTab = redoAction.toTab;
    renderTabs();
    switchTab(currentTab);
    safeLocalStorageSet("notes", notes);
  } else if (redoAction.type === "delete") {
    // إعادة الحذف
    if (!notes[redoAction.tabId]) notes[redoAction.tabId] = [];
    notes[redoAction.tabId].splice(redoAction.index, 1);
    if (redoAction.movedToTrash) {
      // أعدها إلى المحذوفات كما في عملية الحذف الأصلية
      const trashObj = {
        text: redoAction.text,
        from: redoAction.trashFrom,
        createdAt: (redoAction.originalNote && redoAction.originalNote.createdAt) ? redoAction.originalNote.createdAt : undefined
      };
      notes["trash"].unshift(trashObj);
    }
    undoStack.push(redoAction);
    currentTab = redoAction.tabId;
    renderTabs();
    switchTab(currentTab);
    safeLocalStorageSet("notes", notes);
  }
}
//                                 تصدير الملاحظات

function exportNotes() {
  const data = {
    notes: notes,
    tabNames: tabNames
  };

  // 🕒 توليد التاريخ بصيغة YYYY-MM-DD
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const dateString = `${yyyy}-${mm}-${dd}`;

  // 📁 اسم الملف مع التاريخ
  const filename = `clip-note_backup_${dateString}.json`;

  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

//                    استيراد الملاحظات
function importNotes() {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = ".json";
  input.onchange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const imported = JSON.parse(reader.result);
        if (imported.notes && imported.tabNames) {
          notes = imported.notes;
          tabNames = imported.tabNames;
          safeLocalStorageSet("notes", notes);
          safeLocalStorageSet("tabNames", tabNames);
          renderTabs();
          switchTab("1");
          renderNotes();
          alert("✅ تم استيراد جميع اللوحات والملاحظات بنجاح");
        } else {
          alert("❌ الملف لا يحتوي على بيانات كاملة");
        }
      } catch {
        alert("❌ الملف غير صالح أو تالف");
      }
    };
    reader.readAsText(file);
  };
  input.click();
}
//                       اضافة لوحة
function addNewTab() {
  const newName = prompt("🆕 أدخل اسم اللوحة الجديدة:");
  if (newName) {
    // توليد رقم معرف جديد لا يتكرر
    let newId = 1;
    while (tabNames.hasOwnProperty(String(newId))) {
      newId++;
    }
    newId = String(newId);
    tabNames[newId] = newName;
    notes[newId] = [];
    safeLocalStorageSet("tabNames", tabNames);
    safeLocalStorageSet("notes", notes);
    renderTabs();
    switchTab(newId);
  }
}
//                           تعديل اسم اللوحة الحالية
function renameCurrentTab() {
  if (currentTab === "trash" || currentTab === 'settings' || currentTab === 'home') {
    alert("❌ لا يمكن إعادة تسمية هذه اللوحة.");
    return;
  }
  const currentName = tabNames[currentTab];
  const newName = prompt("✏️ أدخل الاسم الجديد للوحة:", currentName);
  if (newName && newName !== currentName) {
    tabNames[currentTab] = newName;
    safeLocalStorageSet("tabNames", tabNames);
    renderTabs();
    updateActiveTab();
  }
}


// وظيفة تصغير الصورة بنسبة 20% من مساحة الملاحظة
function resizeImage(file, callback) {
  const reader = new FileReader();
  reader.onload = function(e) {
    const img = new Image();
    img.onload = function() {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      // حساب عرض مساحة الملاحظة
      const container = document.getElementById('notesContainer');
      const containerWidth = container.offsetWidth;

      // حساب الأبعاد الجديدة (25% من عرض مساحة الملاحظة)
      const newWidth = containerWidth * 0.25;
      const aspectRatio = img.height / img.width;
      const newHeight = newWidth * aspectRatio;

      canvas.width = newWidth;
      canvas.height = newHeight;

      // رسم الصورة المصغرة
      ctx.drawImage(img, 0, 0, newWidth, newHeight);

      // تحويل إلى base64
      const resizedDataUrl = canvas.toDataURL('image/jpeg', 0.8);
      callback(resizedDataUrl);
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

// وظيفة إدراج الصورة في مربع الإدخال مع تحسينات الاستجابة
function insertImageIntoInput(dataUrl) {
  const input = document.getElementById('newNoteInput');
  if (!input) return;

  const img = document.createElement('img');
  img.src = dataUrl;

  // تحسين التنسيق حسب حجم الشاشة
  const isMobile = window.innerWidth <= 768;
  img.style.maxWidth = isMobile ? '35%' : '25%';
  img.style.height = 'auto';
  img.style.borderRadius = '6px';
  img.style.margin = isMobile ? '4px 2px' : '3px 2px';
  img.style.display = 'inline'; // النص يسبح حول الصورة,block يحجز سطر كامل
  img.style.float = 'right';  // الصورة ع اليمين
  //   img.style.verticalAlign = 'top';
  img.style.margin = '0 0 10px 10px'; // مسافة من الأسفل واليسار
  img.style.border = '2px solid #ddd';
  img.style.borderRadius = '8px';
  img.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)';
  img.style.cursor = 'move';

  // إدراج الصورة في موضع المؤشر أو نهاية النص
  try {
    const selection = window.getSelection();
    const range = selection.rangeCount > 0 ? selection.getRangeAt(0) : document.createRange();

    if (input.contains(range.commonAncestorContainer)) {
      range.insertNode(img);
      range.setStartAfter(img);
      range.setEndAfter(img);
      selection.removeAllRanges();
      selection.addRange(range);
    } else {
      input.appendChild(img);
      // إضافة فراغ بعد الصورة لتحسين التخطيط
      input.appendChild(document.createElement('br'));
    }
  } catch (error) {
    // في حالة حدوث خطأ، أدرج الصورة في النهاية
    console.error('خطأ في إدراج الصورة:', error);
    input.appendChild(img);
    input.appendChild(document.createElement('br'));
  }

  // التركيز على مربع الإدخال
  input.focus();
}

// إعداد زر تحميل الصورة
function setupImageUpload() {
  const uploadBtn = document.getElementById('uploadImageBtn');
  const imageInput = document.getElementById('imageInput');

  uploadBtn.addEventListener('click', () => {
    imageInput.click();
  });

  imageInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file && file.type.startsWith('image/')) {
      resizeImage(file, (resizedDataUrl) => {
        insertImageIntoInput(resizedDataUrl);
      });
    }
    // إعادة تعيين input للسماح باختيار نفس الصورة مرة أخرى
    imageInput.value = '';
  });
}

// وظيفة تحديث تنسيق الصور عند تغيير حجم النافذة
function updateImageStyles() {
  const isMobile = window.innerWidth <= 768;
  const images = document.querySelectorAll('#newNoteInput img, #editTextarea img');

  images.forEach(img => {
    if (img.closest('#newNoteInput')) {
      img.style.maxWidth = isMobile ? '35%' : '25%';
    } else if (img.closest('#editTextarea')) {
      img.style.maxWidth = isMobile ? '50%' : '35%';
    }
  });
}

// تسجيل الـ Service Worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js')
      .then(registration => {
        console.log('Service Worker مسجل بنجاح:', registration);
      })
      .catch(error => {
        console.log('فشل في تسجيل Service Worker:', error);
      });
  });
}

// 🚀 تشغيل التهيئة عند تحميل الصفحة
document.addEventListener("DOMContentLoaded", () => {
  try {
    // تطبيق جميع أحجام الخطوط المحفوظة
    try {
      const prefs = safeLocalStorageGet('fontPrefs', {});
      if (prefs.input) document.documentElement.style.setProperty('--input-font-size', prefs.input + 'px');
      if (prefs.note) document.documentElement.style.setProperty('--note-font-size', prefs.note + 'px');
      if (prefs.edit) document.documentElement.style.setProperty('--edit-font-size', prefs.edit + 'px');
      if (prefs.tab) document.documentElement.style.setProperty('--tab-font-size', prefs.tab + 'px');
    } catch {}

    // تطبيق الوضع الليلي المحفوظ
    try {
      const nightMode = safeLocalStorageGet('nightMode', 'false');
      if (nightMode === 'true') {
        document.body.classList.add('night');
      }
    } catch {}

    const firstTabId = renderTabs(); // إنشاء التبويبات واسترجاع أول تبويب
    switchTab(firstTabId);           // تفعيل أول تبويب وعرض ملاحظاته
    setupInputEnterKey();            // تفعيل دعم الضغط على Enter في مربع الإدخال
    setupImageUpload();              // تفعيل تحميل الصور

    // إضافة مستمع لتحديث تنسيق الصور عند تغيير حجم النافذة
    window.addEventListener('resize', updateImageStyles);
  } catch (err) {
    alert('حدث خطأ في جافاسكريبت:\n' + err.message);
    console.error(err);
  }
});


// 🧼 إغلاق القوائم المنبثقة عند الضغط خارجها (منطق موحد)
document.addEventListener("click", function(e) {
  // إذا كان الضغط داخل .menu أو على زر القائمة
  if (
    e.target.closest('.menu') ||
    (e.target.classList && e.target.classList.contains('menu-toggle'))
  ) {
    return;
  }
  // إغلاق جميع القوائم المنبثقة فقط
  document.querySelectorAll(".menu").forEach(m => m.classList.add("hidden"));
  // لا تضع منطق moveMenu هنا، فهو يعالج داخل toggleMoveMenu فقط
});

// متغيرات عامة للترجمة
let currentSourceLang = 'auto';
let currentTargetLang = 'ar';

// وظيفة الترجمة باستخدام Google Translate API
function translateText() {
  const textarea = document.getElementById("editTextarea");
  const text = textarea.innerText.trim();
  if (!text) {
    alert("لا يوجد نص للترجمة");
    return;
  }

  // كشف اللغة الأساسية (بسيط)
  const isArabic = /[\u0600-\u06FF]/.test(text);
  currentSourceLang = isArabic ? 'ar' : 'en';
  currentTargetLang = isArabic ? 'en' : 'ar';

  // عرض النص الأصلي أولاً
  document.getElementById("originalText").value = text;
  document.getElementById("originalText").style.direction = currentSourceLang === 'ar' ? 'rtl' : 'ltr';
  document.getElementById("translatedText").value = '';

  // تعيين اللغات في القوائم المنسدلة
  document.getElementById("sourceLangSelect").value = currentSourceLang;
  document.getElementById("targetLangSelect").value = currentTargetLang;

  // فتح نافذة الترجمة
  document.getElementById("translateModal").classList.remove("hidden");

  // إعداد مستمعي الأحداث للترجمة الفورية
  setupTranslationListeners();

  // بدء الترجمة الأولية
  performTranslation(text, currentSourceLang, currentTargetLang).catch(error => {
    console.error('خطأ في الترجمة الأولية:', error);
  });
}

// وظيفة تنفيذ الترجمة
function performTranslation(text, sourceLang, targetLang) {
  return new Promise((resolve, reject) => {
    const apiUrl = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${sourceLang}&tl=${targetLang}&dt=t&q=${encodeURIComponent(text)}`;

    fetch(apiUrl)
      .then(response => {
        if (!response.ok) {
          throw new Error('فشل في الاتصال بخدمة الترجمة');
        }
        return response.json();
      })
      .then(data => {
        let translatedText = '';
        if (data && data[0]) {
          // جمع جميع الأجزاء المترجمة للنصوص الطويلة
          for (let i = 0; i < data[0].length; i++) {
            if (data[0][i] && data[0][i][0]) {
              translatedText += data[0][i][0];
            }
          }
        }

        // تحديث النص المترجم فقط (لا نحدث النص الأصلي هنا)
        const translatedElement = document.getElementById("translatedText");
        if (translatedElement) {
          translatedElement.value = translatedText;
          translatedElement.style.direction = targetLang === 'ar' ? 'rtl' : 'ltr';
        }

        resolve(translatedText);
      })
      .catch(error => {
        console.error('خطأ في الترجمة:', error);
        // عرض رسالة خطأ في حالة فشل الترجمة
        const translatedElement = document.getElementById("translatedText");
        if (translatedElement) {
          translatedElement.value = "خطأ: لا يمكن الترجمة بدون إتصال أنترنت.";
          translatedElement.style.direction = 'rtl';
        }
        reject(error);
      });
  });
}

// وظيفة تبديل اللغات
function swapLanguages() {
  const originalText = document.getElementById("originalText").value;
  const translatedText = document.getElementById("translatedText").value;
  if (!originalText.trim()) return;

  // تبديل اللغات والنصوص
  const tempLang = currentSourceLang;
  currentSourceLang = currentTargetLang;
  currentTargetLang = tempLang;

  // تبديل النصوص في الحقول
  document.getElementById("originalText").value = translatedText;
  document.getElementById("translatedText").value = originalText;

  // تحديث اتجاه النص
  document.getElementById("originalText").style.direction = currentSourceLang === 'ar' ? 'rtl' : 'ltr';
  document.getElementById("translatedText").style.direction = currentTargetLang === 'ar' ? 'rtl' : 'ltr';

  // تحديث القوائم المنسدلة
  document.getElementById("sourceLangSelect").value = currentSourceLang;
  document.getElementById("targetLangSelect").value = currentTargetLang;
}

// إغلاق نافذة الترجمة
function closeTranslateModal() {
  document.getElementById("translateModal").classList.add("hidden");
}

// نسخ النص الأصلي
function copyOriginalText() {
  const text = document.getElementById("originalText");
  if (text) {
    const content = text.value || text.innerText || text.textContent || '';
    navigator.clipboard.writeText(content).then(() => {
      showToast("تم نسخ النص الأصلي ✅");
    }).catch(err => {
      console.error('فشل في نسخ النص:', err);
      // محاولة بديلة باستخدام document.execCommand
      try {
        const textArea = document.createElement('textarea');
        textArea.value = content;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        showToast("تم نسخ النص الأصلي ✅");
      } catch (fallbackErr) {
        console.error('فشل في النسخ البديل:', fallbackErr);
        showToast("❌ فشل في نسخ النص");
      }
    });
  } else {
    showToast("❌ لم يتم العثور على النص الأصلي");
  }
}

// نسخ النص المترجم
function copyTranslatedText() {
  const text = document.getElementById("translatedText");
  if (text) {
    const content = text.value || text.innerText || text.textContent || '';
    navigator.clipboard.writeText(content).then(() => {
      showToast("تم نسخ الترجمة ✅");
    }).catch(err => {
      console.error('فشل في نسخ النص:', err);
      // محاولة بديلة باستخدام document.execCommand
      try {
        const textArea = document.createElement('textarea');
        textArea.value = content;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        showToast("تم نسخ الترجمة ✅");
      } catch (fallbackErr) {
        console.error('فشل في النسخ البديل:', fallbackErr);
        showToast("❌ فشل في نسخ النص");
      }
    });
  } else {
    showToast("❌ لم يتم العثور على النص المترجم");
  }
}

// متغير للتحكم في الترجمة الفورية
let translationTimeout;

// متغير لتتبع الملاحظات التي تحتوي على صور لتحديث تموضعها
let notesWithImages = new Set();

// متغير لتتبع حالة التحرير
let isEditModalOpen = false;

// متغير لحفظ تموضع الصور في نافذة التحرير
let editModalImagePositions = {};

// وظيفة تنسيق تلقائي للنص العربي والإنجليزي
function autoFormatTextDirection(textarea) {
  if (!textarea) return;

  const text = textarea.innerText || textarea.textContent || '';
  if (!text.trim()) return;

  // كشف اللغة الرئيسية في النص
  const arabicChars = /[\u0600-\u06FF]/g;
  const englishChars = /[a-zA-Z]/g;

  const arabicCount = (text.match(arabicChars) || []).length;
  const englishCount = (text.match(englishChars) || []).length;

  // إذا كان النص يحتوي على كلا اللغتين، استخدم اتجاه مختلط
  if (arabicCount > 0 && englishCount > 0) {
    // تنسيق النص ليكون مختلطاً
    formatMixedText(textarea);
  } else if (arabicCount > englishCount) {
    // النص عربي بشكل أساسي
    textarea.style.direction = 'rtl';
    textarea.style.textAlign = 'right';
  } else if (englishCount > arabicCount) {
    // النص إنجليزي بشكل أساسي
    textarea.style.direction = 'ltr';
    textarea.style.textAlign = 'left';
  } else {
    // النص العربي بشكل افتراضي
    textarea.style.direction = 'rtl';
    textarea.style.textAlign = 'right';
  }
}

// وظيفة تنسيق النص المختلط (عربي وإنجليزي)
function formatMixedText(textarea) {
  // إذا كان النص يحتوي على صور، لا نقم بالتنسيق المعقد للحفاظ على الصور
  const hasImages = textarea.querySelectorAll('img').length > 0;
  if (hasImages) {
    // فقط ضبط اتجاه النص العام
    textarea.style.direction = 'rtl';
    textarea.style.textAlign = 'right';
    return;
  }

  const text = textarea.innerText || textarea.textContent || '';
  if (!text.trim()) return;

  // تقسيم النص إلى كلمات مع الحفاظ على علامات الترقيم
  const words = text.split(/(\s+|[.,!?;:])/);

  // إنشاء محتوى HTML جديد مع تنسيق لكل كلمة
  let formattedHTML = '';

  for (const word of words) {
    if (word.trim() === '' || /^[.,!?;:]$/.test(word)) {
      // المسافات والفراغات وعلامات الترقيم
      formattedHTML += word;
    } else {
      // كشف لغة الكلمة
      const isArabic = /[\u0600-\u06FF]/.test(word);
      const isEnglish = /[a-zA-Z]/.test(word);

      if (isArabic && !isEnglish) {
        // كلمة عربية - استخدم اتجاه RTL
        formattedHTML += `<span style="direction: rtl; unicode-bidi: embed; display: inline;">${word}</span>`;
      } else if (isEnglish && !isArabic) {
        // كلمة إنجليزية - استخدم اتجاه LTR
        formattedHTML += `<span style="direction: ltr; unicode-bidi: embed; display: inline;">${word}</span>`;
      } else {
        // كلمة مختلطة أو رموز أخرى
        formattedHTML += word;
      }
    }
  }

  // الحفاظ على اتجاه النص العام كـ RTL للنصوص العربية
  textarea.style.direction = 'rtl';
  textarea.style.textAlign = 'right';
  textarea.style.unicodeBidi = 'plaintext';

  // تطبيق التنسيق
  const selection = window.getSelection();
  const range = selection.rangeCount > 0 ? selection.getRangeAt(0) : null;
  const cursorPosition = range ? getCursorPosition(textarea, range) : null;

  // تطبيق النص المنسق
  textarea.innerHTML = formattedHTML;

  // استعادة موضع المؤشر إذا أمكن
  if (cursorPosition !== null) {
    setTimeout(() => setCursorPosition(textarea, cursorPosition), 10);
  }
}

// وظيفة للحصول على موضع المؤشر في textarea
function getCursorPosition(textarea, range) {
  try {
    const preCaretRange = range.cloneRange();
    preCaretRange.selectNodeContents(textarea);
    preCaretRange.setEnd(range.endContainer, range.endOffset);
    return preCaretRange.toString().length;
  } catch (e) {
    return null;
  }
}

// وظيفة لتعيين موضع المؤشر في textarea
function setCursorPosition(textarea, position) {
  try {
    const range = document.createRange();
    const selection = window.getSelection();

    // العثور على العقدة النصية المناسبة
    let node = textarea.firstChild;
    let remaining = position;

    while (node && remaining > 0) {
      if (node.nodeType === Node.TEXT_NODE) {
        if (remaining <= node.textContent.length) {
          range.setStart(node, remaining);
          range.setEnd(node, remaining);
          break;
        } else {
          remaining -= node.textContent.length;
        }
      }
      node = getNextNode(node);
    }

    if (node) {
      selection.removeAllRanges();
      selection.addRange(range);
    }
  } catch (e) {
    // في حالة الخطأ، ضع المؤشر في نهاية النص
    textarea.focus();
  }
}

// وظيفة مساعدة للحصول على العقدة التالية
function getNextNode(node) {
  if (node.firstChild) {
    return node.firstChild;
  }
  while (node) {
    if (node.nextSibling) {
      return node.nextSibling;
    }
    node = node.parentNode;
  }
  return null;
}

// وظيفة تحديث تموضع الصور في الملاحظات الأصلية
function updateImagePositionsInNotes() {
  try {
    const editTextarea = document.getElementById('editTextarea');
    if (!editTextarea) return;

    const images = editTextarea.querySelectorAll('img');

    // تحديث قائمة الملاحظات التي تحتوي على صور
    notes[currentTab].forEach((note, index) => {
      const noteText = (typeof note === 'object' && note.text) ? note.text : note;
      if (noteText.includes('<img')) {
        notesWithImages.add(`${currentTab}_${index}`);
      }
    });

    // حفظ تموضع الصور في البيانات
    images.forEach((img, imgIndex) => {
      const imgSrc = img.src;
      const imgClass = img.className;

      // البحث عن هذه الصورة في الملاحظات وحفظ تموضعها
      notes[currentTab].forEach((note, noteIndex) => {
        let noteText = (typeof note === 'object' && note.text) ? note.text : note;
        if (noteText.includes(imgSrc)) {
          // حفظ معلومات التموضع مع الصورة
          const noteObj = (typeof note === 'object') ? note : { text: note };
          noteObj.imagePositions = noteObj.imagePositions || {};

          // الحصول على الموضع النسبي للصورة داخل نافذة التحرير
          const textareaRect = editTextarea.getBoundingClientRect();
          const imgRect = img.getBoundingClientRect();

          noteObj.imagePositions[imgSrc] = {
            class: imgClass,
            index: imgIndex,
            position: {
              top: imgRect.top - textareaRect.top,
              left: imgRect.left - textareaRect.left,
              width: imgRect.width,
              height: imgRect.height
            }
          };

          // تحديث النص في الملاحظة
          notes[currentTab][noteIndex] = noteObj;
        }
      });
    });

    console.log('تم تحديث تموضع الصور في الملاحظات');
  } catch (error) {
    console.error('خطأ في تحديث تموضع الصور:', error);
  }
}

// إضافة مستمعي الأحداث للترجمة الفورية
function setupTranslationListeners() {
  const originalText = document.getElementById("originalText");
  const translatedText = document.getElementById("translatedText");
  const sourceLangSelect = document.getElementById("sourceLangSelect");
  const targetLangSelect = document.getElementById("targetLangSelect");

  // مستمع لتغيير لغة المصدر
  sourceLangSelect.addEventListener('change', function() {
    currentSourceLang = this.value;
    document.getElementById("originalText").style.direction = currentSourceLang === 'ar' ? 'rtl' : 'ltr';
    // إعادة الترجمة إذا كان هناك نص
    const text = originalText.value.trim();
    if (text) {
      clearTimeout(translationTimeout);
      translationTimeout = setTimeout(() => {
        performTranslation(text, currentSourceLang, currentTargetLang)
          .catch(error => {
            console.log('تم إلغاء الترجمة أو حدث خطأ:', error);
          });
      }, 300);
    }
  });

  // مستمع لتغيير لغة الهدف
  targetLangSelect.addEventListener('change', function() {
    currentTargetLang = this.value;
    document.getElementById("translatedText").style.direction = currentTargetLang === 'ar' ? 'rtl' : 'ltr';
    // إعادة الترجمة إذا كان هناك نص
    const text = originalText.value.trim();
    if (text) {
      clearTimeout(translationTimeout);
      translationTimeout = setTimeout(() => {
        performTranslation(text, currentSourceLang, currentTargetLang)
          .catch(error => {
            console.log('تم إلغاء الترجمة أو حدث خطأ:', error);
          });
      }, 300);
    }
  });

  // ترجمة فورية عند الكتابة في النص الأصلي مع تأخير
  originalText.addEventListener('input', function() {
    clearTimeout(translationTimeout);
    const text = this.value.trim();

    if (text) {
      translationTimeout = setTimeout(() => {
        performTranslation(text, currentSourceLang, currentTargetLang)
          .catch(error => {
            console.log('تم إلغاء الترجمة أو حدث خطأ:', error);
          });
      }, 500); // انتظار 500ms قبل الترجمة
    } else {
      document.getElementById("translatedText").value = '';
    }
  });

  // ترجمة فورية عند الكتابة في النص المترجم مع تأخير
  translatedText.addEventListener('input', function() {
    clearTimeout(translationTimeout);
    const text = this.value.trim();

    if (text) {
      translationTimeout = setTimeout(() => {
        // تبديل اللغات مؤقتاً للترجمة العكسية
        const tempSource = currentSourceLang;
        const tempTarget = currentTargetLang;
        currentSourceLang = tempTarget;
        currentTargetLang = tempSource;

        performTranslation(text, currentSourceLang, currentTargetLang)
          .then(() => {
            // إعادة اللغات الأصلية
            currentSourceLang = tempSource;
            currentTargetLang = tempTarget;
          })
          .catch(error => {
            // إعادة اللغات الأصلية في حالة الخطأ
            currentSourceLang = tempSource;
            currentTargetLang = tempTarget;
            console.log('تم إلغاء الترجمة أو حدث خطأ:', error);
          });
      }, 500); // انتظار 500ms قبل الترجمة
    } else {
      document.getElementById("originalText").value = '';
    }
  });
}

// وظيفة جعل الصور قابلة للسحب والإفلات مع تحسينات
function makeImagesDraggable() {
  const editTextarea = document.getElementById("editTextarea");
  if (!editTextarea) return;

  // إضافة مؤشر للصور لتحسين تجربة السحب والتموضع الحر
  editTextarea.style.position = 'relative';

  const images = editTextarea.querySelectorAll('img');

  images.forEach(img => {
    // إزالة المستمعين السابقين لتجنب التكرار
    img.removeEventListener('mousedown', handleMouseDown);
    img.removeEventListener('dragstart', handleDragStart);
    img.removeEventListener('dragend', handleDragEnd);
    img.removeEventListener('touchstart', handleTouchStart);
    img.removeEventListener('touchmove', handleTouchMove);
    img.removeEventListener('touchend', handleTouchEnd);

    img.draggable = true;
    img.style.cursor = 'move';

    let isDragging = false;
    let startX, startY, initialX, initialY;

    // دعم السحب بالماوس للديسكتوب
    function handleMouseDown(e) {
      isDragging = false;
      startX = e.clientX;
      startY = e.clientY;
      initialX = img.offsetLeft;
      initialY = img.offsetTop;

      function handleMouseMove(e) {
        if (Math.abs(e.clientX - startX) > 5 || Math.abs(e.clientY - startY) > 5) {
          isDragging = true;
          img.style.position = 'fixed';
          img.style.left = e.clientX - 25 + 'px';
          img.style.top = e.clientY - 25 + 'px';
          img.style.zIndex = '1000';
          img.style.pointerEvents = 'none';
          img.style.transform = 'rotate(2deg)';
        }
      }

      function handleMouseUp(e) {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);

        if (isDragging) {
          img.style.position = '';
          img.style.left = '';
          img.style.top = '';
          img.style.zIndex = '';
          img.style.pointerEvents = '';
          img.style.transform = '';

          // محاولة إدراج الصورة في المكان الجديد مع تحسين التموضع
          try {
            let range;
            if (document.caretRangeFromPoint) {
              range = document.caretRangeFromPoint(e.clientX, e.clientY);
            } else if (document.caretPositionFromPoint) {
              const pos = document.caretPositionFromPoint(e.clientX, e.clientY);
              range = pos.range || pos;
            }

            if (range && typeof range.insertNode === 'function') {
              // إزالة الصورة من مكانها الأصلي
              if (img.parentNode) {
                img.parentNode.removeChild(img);
              }

              // تحديد نوع التموضع بناءً على موضع الإفلات - مبسط
              const textareaRect = editTextarea.getBoundingClientRect();
              const dropX = e.clientX - textareaRect.left;
              const textareaWidth = textareaRect.width;

              // تموضع بسيط: صورة على اليمين أو النص مضمن
              if (dropX > textareaWidth * 0.5) {
                img.className = 'float-right';
              } else {
                img.className = 'inline';
              }

              range.insertNode(img);

              // إضافة مسافة بعد الصورة لتحسين التدفق
              const spaceNode = document.createTextNode(' ');
              range.insertNode(spaceNode);
            } else {
              // إذا لم نتمكن من الحصول على range صالح، أعد إدراج الصورة في نهاية النص
              if (img.parentNode) {
                img.parentNode.removeChild(img);
              }
              img.className = 'inline';
              editTextarea.appendChild(img);
              editTextarea.appendChild(document.createTextNode(' '));
            }
          } catch (error) {
            console.error('خطأ في إدراج الصورة:', error);
            // في حالة الخطأ، أعد إدراج الصورة في نهاية النص
            if (img.parentNode) {
              img.parentNode.removeChild(img);
            }
            img.className = 'inline';
            editTextarea.appendChild(img);
            editTextarea.appendChild(document.createTextNode(' '));
          }
        }
      }

      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    function handleDragStart(e) {
      e.dataTransfer.setData('text/html', img.outerHTML);
      e.dataTransfer.effectAllowed = 'move';
      img.style.opacity = '0.7';
    }

    function handleDragEnd(e) {
      img.style.opacity = '1';
    }

    // دعم السحب باللمس للجوال مع تحسينات
    let touchData = null;

    function handleTouchStart(e) {
      touchData = {
        startX: e.touches[0].clientX,
        startY: e.touches[0].clientY,
        element: this,
        placeholder: null
      };

      this.style.opacity = '0.7';

      // إنشاء عنصر نائب مؤقت
      touchData.placeholder = document.createElement('span');
      touchData.placeholder.innerHTML = ' ';
      touchData.placeholder.style.display = 'inline-block';
      touchData.placeholder.style.width = this.offsetWidth + 'px';
      touchData.placeholder.style.height = this.offsetHeight + 'px';

      if (this.nextSibling) {
        this.parentNode.insertBefore(touchData.placeholder, this.nextSibling);
      } else {
        this.parentNode.appendChild(touchData.placeholder);
      }
    }

    function handleTouchMove(e) {
      if (!touchData) return;

      e.preventDefault();
      const touch = e.touches[0];
      const deltaX = touch.clientX - touchData.startX;
      const deltaY = touch.clientY - touchData.startY;

      // ابدأ السحب بعد حركة معينة
      if (Math.abs(deltaX) > 10 || Math.abs(deltaY) > 10) {
        touchData.element.style.position = 'fixed';
        touchData.element.style.left = touch.clientX - 25 + 'px';
        touchData.element.style.top = touch.clientY - 25 + 'px';
        touchData.element.style.zIndex = '1000';
        touchData.element.style.pointerEvents = 'none';
      }
    }

    function handleTouchEnd(e) {
      if (!touchData) return;

      const touch = e.changedTouches[0];

      // إزالة العنصر النائب
      if (touchData.placeholder && touchData.placeholder.parentNode) {
        touchData.placeholder.parentNode.removeChild(touchData.placeholder);
      }

      // استعادة التنسيق الأصلي
      touchData.element.style.opacity = '1';
      touchData.element.style.position = '';
      touchData.element.style.left = '';
      touchData.element.style.top = '';
      touchData.element.style.zIndex = '';
      touchData.element.style.pointerEvents = '';

      // محاولة إدراج الصورة في المكان الجديد
      try {
        let range;
        if (document.caretRangeFromPoint) {
          range = document.caretRangeFromPoint(touch.clientX, touch.clientY);
        } else if (document.caretPositionFromPoint) {
          const pos = document.caretPositionFromPoint(touch.clientX, touch.clientY);
          range = pos.range || pos;
        }

        if (range && typeof range.insertNode === 'function') {
          // إزالة الصورة من مكانها الأصلي
          if (touchData.element.parentNode) {
            touchData.element.parentNode.removeChild(touchData.element);
          }

          // تحديد نوع التموضع بناءً على موضع الإفلات للجوال - مبسط
          const textareaRect = editTextarea.getBoundingClientRect();
          const dropX = touch.clientX - textareaRect.left;
          const textareaWidth = textareaRect.width;

          // تموضع بسيط: صورة على اليمين أو النص مضمن
          if (dropX > textareaWidth * 0.5) {
            touchData.element.className = 'float-right';
          } else {
            touchData.element.className = 'inline';
          }

          range.insertNode(touchData.element);

          // إضافة مسافة بعد الصورة لتحسين التدفق
          const spaceNode = document.createTextNode(' ');
          range.insertNode(spaceNode);
        } else {
          // إذا لم نتمكن من الحصول على range صالح، أعد إدراج الصورة في نهاية النص
          if (touchData.element.parentNode) {
            touchData.element.parentNode.removeChild(touchData.element);
          }
          touchData.element.className = 'inline';
          editTextarea.appendChild(touchData.element);
          editTextarea.appendChild(document.createTextNode(' '));
        }
      } catch (error) {
        console.error('خطأ في إدراج الصورة:', error);
        // في حالة الخطأ، أعد إدراج الصورة في نهاية النص
        if (touchData.element.parentNode) {
          touchData.element.parentNode.removeChild(touchData.element);
        }
        editTextarea.appendChild(touchData.element);
      }

      touchData = null;
    }

    img.addEventListener('mousedown', handleMouseDown);
    img.addEventListener('dragstart', handleDragStart);
    img.addEventListener('dragend', handleDragEnd);
    img.addEventListener('touchstart', handleTouchStart, { passive: false });
    img.addEventListener('touchmove', handleTouchMove, { passive: false });
    img.addEventListener('touchend', handleTouchEnd);
  });

  // دعم السحب بالماوس للديسكتوب مع تحسينات
  function handleDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }

  function handleDrop(e) {
    e.preventDefault();
    try {
      const draggedHTML = e.dataTransfer.getData('text/html');
      if (draggedHTML && draggedHTML.includes('<img')) {
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = draggedHTML;
        const draggedImg = tempDiv.firstChild;

        // إزالة الصورة المسحوبة من مكانها الأصلي
        const originalImg = editTextarea.querySelector(`img[src="${draggedImg.src}"]`);
        if (originalImg && originalImg !== draggedImg) {
          originalImg.remove();
        }

        // تحديد نوع التموضع بناءً على موضع الإفلات للديسكتوب - مبسط
        const textareaRect = editTextarea.getBoundingClientRect();
        const dropX = e.clientX - textareaRect.left;
        const textareaWidth = textareaRect.width;

        // تموضع بسيط: صورة على اليمين أو النص مضمن
        if (dropX > textareaWidth * 0.5) {
          draggedImg.className = 'float-right';
        } else {
          draggedImg.className = 'inline';
        }

        // إدراج الصورة في المكان الجديد
        let range;
        if (document.caretRangeFromPoint) {
          range = document.caretRangeFromPoint(e.clientX, e.clientY);
        } else if (document.caretPositionFromPoint) {
          const pos = document.caretPositionFromPoint(e.clientX, e.clientY);
          range = pos.range || pos;
        }

        if (range && typeof range.insertNode === 'function') {
          range.insertNode(draggedImg);
          // إضافة مسافة بعد الصورة لتحسين التدفق
          const spaceNode = document.createTextNode(' ');
          range.insertNode(spaceNode);
        } else {
          editTextarea.appendChild(draggedImg);
          editTextarea.appendChild(document.createTextNode(' '));
        }
      }
    } catch (error) {
      console.error('خطأ في إفلات الصورة:', error);
    }
  }

  // إزالة المستمعين السابقين
  editTextarea.removeEventListener('dragover', handleDragOver);
  editTextarea.removeEventListener('drop', handleDrop);

  editTextarea.addEventListener('dragover', handleDragOver);
  editTextarea.addEventListener('drop', handleDrop);
}


// ⎋ إغلاق نافذة التحرير عند الضغط على زر ESC
document.addEventListener("keydown", function(e) {
  if (e.key === "Escape") {
    closeEditModal();
  }
});
