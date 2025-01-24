import React, { useState } from 'react';
import { Upload, Type, Move, MessageSquare, Palette } from 'lucide-react';
import type { BotSettings } from '../types';

export const ChatbotCustomization = () => {
  const [settings, setSettings] = useState<BotSettings>({
    name: 'Support Bot',
    icon: 'https://images.unsplash.com/photo-1531379410502-63bfe8cdaf6f?w=200&h=200&fit=crop&crop=faces',
    fontSize: '14px',
    fontStyle: 'Inter',
    position: { x: 20, y: 20 },
    maxMessageLength: 500,
    botColor: '#E3F2FD',
    userColor: '#F3E5F5',
  });

  const handleChange = (field: keyof BotSettings, value: any) => {
    setSettings((prev) => ({ ...prev, [field]: value }));
  };

  const sections = [
    {
      title: 'Bot Identity',
      icon: MessageSquare,
      fields: [
        {
          label: 'Bot Name',
          type: 'text',
          value: settings.name,
          onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
            handleChange('name', e.target.value),
        },
        {
          label: 'Bot Icon',
          type: 'file',
          accept: 'image/*',
          onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
            if (e.target.files?.[0]) {
              // Handle file upload in production
              console.log('File selected:', e.target.files[0]);
            }
          },
        },
      ],
    },
    {
      title: 'Typography',
      icon: Type,
      fields: [
        {
          label: 'Font Size',
          type: 'select',
          value: settings.fontSize,
          options: ['12px', '14px', '16px', '18px'],
          onChange: (e: React.ChangeEvent<HTMLSelectElement>) =>
            handleChange('fontSize', e.target.value),
        },
        {
          label: 'Font Style',
          type: 'select',
          value: settings.fontStyle,
          options: ['Inter', 'Roboto', 'Open Sans', 'Lato'],
          onChange: (e: React.ChangeEvent<HTMLSelectElement>) =>
            handleChange('fontStyle', e.target.value),
        },
      ],
    },
    {
      title: 'Position',
      icon: Move,
      fields: [
        {
          label: 'X Position',
          type: 'range',
          min: 0,
          max: 100,
          value: settings.position.x,
          onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
            handleChange('position', {
              ...settings.position,
              x: parseInt(e.target.value),
            }),
        },
        {
          label: 'Y Position',
          type: 'range',
          min: 0,
          max: 100,
          value: settings.position.y,
          onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
            handleChange('position', {
              ...settings.position,
              y: parseInt(e.target.value),
            }),
        },
      ],
    },
    {
      title: 'Message Settings',
      icon: Palette,
      fields: [
        {
          label: 'Max Message Length',
          type: 'number',
          min: 100,
          max: 1000,
          value: settings.maxMessageLength,
          onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
            handleChange('maxMessageLength', parseInt(e.target.value)),
        },
        {
          label: 'Bot Message Color',
          type: 'color',
          value: settings.botColor,
          onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
            handleChange('botColor', e.target.value),
        },
        {
          label: 'User Message Color',
          type: 'color',
          value: settings.userColor,
          onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
            handleChange('userColor', e.target.value),
        },
      ],
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Chatbot Customization
        </h1>
        <button className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors">
          Save Changes
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Settings Panel */}
        <div className="space-y-6">
          {sections.map((section) => (
            <div
              key={section.title}
              className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6"
            >
              <div className="flex items-center space-x-2 mb-4">
                <section.icon className="w-5 h-5 text-blue-500" />
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                  {section.title}
                </h2>
              </div>
              <div className="space-y-4">
                {section.fields.map((field) => (
                  <div key={field.label}>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      {field.label}
                    </label>
                    {field.type === 'select' ? (
                      <select
                        value={field.value}
                        onChange={field.onChange}
                        className="w-full rounded-lg border-gray-300 dark:border-gray-600 dark:bg-gray-700 focus:ring-blue-500 focus:border-blue-500"
                      >
                        {field.options?.map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type={field.type}
                        value={field.value}
                        min={field.min}
                        max={field.max}
                        accept={field.accept}
                        onChange={field.onChange}
                        className="w-full rounded-lg border-gray-300 dark:border-gray-600 dark:bg-gray-700 focus:ring-blue-500 focus:border-blue-500"
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Preview Panel */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 sticky top-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Preview
          </h2>
          <div className="aspect-video bg-gray-100 dark:bg-gray-700 rounded-lg p-4 relative">
            <div
              style={{
                position: 'absolute',
                left: `${settings.position.x}%`,
                top: `${settings.position.y}%`,
                transform: 'translate(-50%, -50%)',
              }}
              className="flex items-center space-x-2 bg-white dark:bg-gray-800 p-2 rounded-lg shadow-lg"
            >
              <img
                src={settings.icon}
                alt="Bot Icon"
                className="w-8 h-8 rounded-full"
              />
              <span
                style={{
                  fontSize: settings.fontSize,
                  fontFamily: settings.fontStyle,
                }}
                className="font-medium text-gray-900 dark:text-white"
              >
                {settings.name}
              </span>
            </div>
            <div className="absolute bottom-4 right-4 left-4 space-y-2">
              <div
                style={{ backgroundColor: settings.botColor }}
                className="p-3 rounded-lg max-w-[80%] ml-4"
              >
                <p className="text-gray-800">Hello! How can I help you today?</p>
              </div>
              <div
                style={{ backgroundColor: settings.userColor }}
                className="p-3 rounded-lg max-w-[80%] ml-auto mr-4"
              >
                <p className="text-gray-800">I have a question about...</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};