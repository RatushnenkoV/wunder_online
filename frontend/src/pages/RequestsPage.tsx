import { useState, useEffect } from 'react';


// ─── АХО форма ───────────────────────────────────────────────────────────────



function AhoTab() {
  useEffect(() => {
    // insert bitrix24 form script into the div
    const script = document.createElement('script');
    script.setAttribute('data-b24-form', 'inline/48/1o9nvq');
    script.setAttribute('data-skip-moving', 'true');
    script.src =
      'https://cdn-ru.bitrix24.kz/b27680670/crm/form/loader_48.js?' +
      ((Date.now() / 180000) | 0);
    script.async = true;

    const target = document.getElementById('bx24_form_aho');
    if (target) {
      // clear any previous content (in case of remount)
      target.innerHTML = '';
      target.appendChild(script);
    }
  }, []);

  return (
    <div className="">
      <div
        className="bg-white rounded-xl border border-gray-200 shadow-sm text-center"
        id="bx24_form_aho"
      ></div>
    </div>
  );
}

// ─── ИТ-отдел (заглушка) ─────────────────────────────────────────────────────

function ItTab() {
  useEffect(() => {
    const script = document.createElement('script');
    script.setAttribute('data-b24-form', 'inline/36/ky1p38');
    script.setAttribute('data-skip-moving', 'true');
    script.src =
      'https://cdn-ru.bitrix24.kz/b16534274/crm/form/loader_36.js?' +
      ((Date.now() / 180000) | 0);
    script.async = true;

    const target = document.getElementById('bx24_form_IT');
    if (target) {
      target.innerHTML = '';
      target.appendChild(script);
    }
  }, []);

  return (
    <div>
      <div
        className="bg-white rounded-xl border border-gray-200 shadow-sm text-center"
        id="bx24_form_IT"
      ></div>
    </div>
  );
}

// ─── Главная страница ─────────────────────────────────────────────────────────

type Tab = 'aho' | 'it';

export default function RequestsPage() {
  const [activeTab, setActiveTab] = useState<Tab>('aho');

  const tabs: { id: Tab; label: string }[] = [
    { id: 'aho', label: 'Заявки в АХО' },
    { id: 'it', label: 'Заявки в ИТ' },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-5">Заявки</h1>

      {/* Вкладки */}
      <div className="flex gap-1 mb-6 border-b border-gray-200">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={[
              'px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors',
              activeTab === tab.id
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-800',
            ].join(' ')}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'aho' && <AhoTab />}
      {activeTab === 'it' && <ItTab />}
    </div>
  );
}
