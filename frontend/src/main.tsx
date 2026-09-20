import React from 'react';
import ReactDOM from 'react-dom/client';
import { ConfigProvider } from 'antd';
import thTH from 'antd/locale/th_TH';
import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ConfigProvider
      locale={thTH}
      theme={{
        token: {
          colorPrimary:        '#2563eb',
          colorBgBase:         '#ffffff',
          colorBgContainer:    '#ffffff',
          colorBgLayout:       '#f8fafc',
          colorBorder:         '#e2e8f0',
          colorBorderSecondary:'#f1f5f9',
          colorText:           '#0f172a',
          colorTextSecondary:  '#64748b',
          colorTextPlaceholder:'#94a3b8',
          borderRadius:         6,
          borderRadiusLG:       8,
          borderRadiusSM:       4,
          fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
          fontSize:             14,
          lineHeight:           1.6,
          controlHeight:        34,
          paddingContentVertical:   8,
          paddingContentHorizontal: 16,
          boxShadow:      'none',
          boxShadowSecondary: 'none',
          boxShadowTertiary:  'none',
        },
        components: {
          Layout: {
            siderBg:    '#ffffff',
            bodyBg:     '#f8fafc',
            headerBg:   '#ffffff',
          },
          Menu: {
            itemBg:             '#ffffff',
            itemSelectedBg:     '#eff6ff',
            itemSelectedColor:  '#2563eb',
            itemHoverBg:        '#f8fafc',
            itemHoverColor:     '#0f172a',
            itemColor:          '#374151',
            itemActiveBg:       '#eff6ff',
            activeBarWidth:     3,
            activeBarBorderWidth: 3,
          },
          Table: {
            headerBg:       '#f8fafc',
            headerColor:    '#64748b',
            rowHoverBg:     '#f8fafc',
            borderColor:    '#e2e8f0',
            cellPaddingBlock: 10,
            cellPaddingInline: 16,
          },
          Button: {
            primaryColor: '#ffffff',
            defaultBorderColor: '#e2e8f0',
            defaultColor: '#374151',
          },
          Input: {
            activeBorderColor:   '#2563eb',
            activeShadow:        '0 0 0 2px #bfdbfe',
            hoverBorderColor:    '#93c5fd',
          },
          Select: {
            optionSelectedBg:    '#eff6ff',
            optionSelectedColor: '#2563eb',
          },
          Modal: {
            borderRadiusLG: 10,
          },
          Alert: {
            borderRadiusLG: 6,
          },
          Tag: {
            borderRadiusSM: 4,
          },
        },
      }}
    >
      <App />
    </ConfigProvider>
  </React.StrictMode>,
);
