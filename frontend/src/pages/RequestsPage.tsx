import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import type { User } from '../types';

// Bitrix24 forms are Vue-powered — setting input.value directly doesn't update the model.
// We must use the native HTMLInputElement setter + dispatch an 'input' event.
function fillBitrixInput(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
  if (setter) setter.call(input, value);
  else input.value = value;
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

// applyFill receives current inputs and user; returns true when done (observer disconnects).
type FillFn = (inputs: NodeListOf<HTMLInputElement>, user: User) => boolean;

function useBitrixAutoFill(containerId: string, applyFill: FillFn) {
  const { user } = useAuth();
  const userRef = useRef(user);
  userRef.current = user;
  const fillRef = useRef(applyFill);
  fillRef.current = applyFill;

  useEffect(() => {
    const target = document.getElementById(containerId);
    if (!target) return;

    let filled = false;
    const observer = new MutationObserver(() => {
      if (filled) return;
      const u = userRef.current;
      if (!u) return;
      const inputs = target.querySelectorAll<HTMLInputElement>('input.b24-form-control');
      if (fillRef.current(inputs, u)) {
        filled = true;
        observer.disconnect();
      }
    });

    observer.observe(target, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [containerId]);
}


// ─── АХО форма ───────────────────────────────────────────────────────────────

function AhoTab() {
  useBitrixAutoFill('bx24_form_aho', (inputs, u) => {
    if (inputs.length < 4) return false;
    const fullName = `${u.first_name} ${u.last_name}`.trim();
    if (fullName && !inputs[0].value) fillBitrixInput(inputs[0], fullName);
    if (u.phone && !inputs[3].value) fillBitrixInput(inputs[3], u.phone);
    return true;
  });

  useEffect(() => {
    const script = document.createElement('script');
    script.setAttribute('data-b24-form', 'inline/48/1o9nvq');
    script.setAttribute('data-skip-moving', 'true');
    script.src =
      'https://cdn-ru.bitrix24.kz/b27680670/crm/form/loader_48.js?' +
      ((Date.now() / 180000) | 0);
    script.async = true;

    const target = document.getElementById('bx24_form_aho');
    if (target) {
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

// ─── ИТ-отдел ─────────────────────────────────────────────────────

function ItTab() {
  useBitrixAutoFill('bx24_form_IT', (inputs, u) => {
    if (inputs.length < 3) return false;
    if (u.first_name && !inputs[0].value) fillBitrixInput(inputs[0], u.first_name);
    if (u.last_name && !inputs[1].value) fillBitrixInput(inputs[1], u.last_name);
    if (u.phone && !inputs[2].value) fillBitrixInput(inputs[2], u.phone);
    return true;
  });

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
