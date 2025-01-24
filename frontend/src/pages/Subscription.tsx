import React from 'react';
import { Check, CreditCard } from 'lucide-react';

export const Subscription = () => {
  const plans = [
    {
      name: 'Basic',
      price: '$29',
      features: [
        '1,000 conversations/month',
        'Basic bot customization',
        'Email support',
        '1 team member',
      ],
      current: false,
    },
    {
      name: 'Professional',
      price: '$99',
      features: [
        'Unlimited conversations',
        'Advanced bot customization',
        'Priority support',
        'Up to 5 team members',
        'Analytics dashboard',
        'Custom integrations',
      ],
      current: true,
    },
    {
      name: 'Enterprise',
      price: 'Custom',
      features: [
        'Everything in Professional',
        'Dedicated support',
        'Unlimited team members',
        'Custom development',
        'SLA guarantee',
        'On-premise deployment',
      ],
      current: false,
    },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
        Subscription & Billing
      </h1>

      {/* Current Plan Status */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Current Plan: Professional
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Your plan renews on April 1, 2024
            </p>
          </div>
          <button className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors">
            Manage Billing
          </button>
        </div>
        <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
          <div className="flex items-center text-blue-700 dark:text-blue-300">
            <CreditCard className="w-5 h-5 mr-2" />
            <span>Next billing amount: $99.00</span>
          </div>
        </div>
      </div>

      {/* Subscription Plans */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {plans.map((plan) => (
          <div
            key={plan.name}
            className={`bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 ${
              plan.current
                ? 'ring-2 ring-blue-500 dark:ring-blue-400'
                : 'hover:shadow-lg transition-shadow'
            }`}
          >
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
              {plan.name}
            </h3>
            <div className="mt-4 flex items-baseline">
              <span className="text-4xl font-extrabold text-gray-900 dark:text-white">
                {plan.price}
              </span>
              {plan.name !== 'Enterprise' && (
                <span className="ml-1 text-gray-500 dark:text-gray-400">
                  /month
                </span>
              )}
            </div>
            <ul className="mt-6 space-y-4">
              {plan.features.map((feature) => (
                <li key={feature} className="flex items-start">
                  <Check className="w-5 h-5 text-green-500 mr-2 flex-shrink-0" />
                  <span className="text-gray-600 dark:text-gray-300">
                    {feature}
                  </span>
                </li>
              ))}
            </ul>
            <button
              className={`mt-8 w-full px-4 py-2 rounded-lg transition-colors ${
                plan.current
                  ? 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 cursor-default'
                  : 'bg-blue-500 hover:bg-blue-600 text-white'
              }`}
              disabled={plan.current}
            >
              {plan.current ? 'Current Plan' : 'Upgrade'}
            </button>
          </div>
        ))}
      </div>

      {/* Payment History */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Payment History
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-700">
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Amount
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Invoice
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {[
                {
                  date: 'Mar 1, 2024',
                  amount: '$99.00',
                  status: 'Paid',
                  invoice: '#INV-2024-003',
                },
                {
                  date: 'Feb 1, 2024',
                  amount: '$99.00',
                  status: 'Paid',
                  invoice: '#INV-2024-002',
                },
                {
                  date: 'Jan 1, 2024',
                  amount: '$99.00',
                  status: 'Paid',
                  invoice: '#INV-2024-001',
                },
              ].map((payment) => (
                <tr
                  key={payment.invoice}
                  className="hover:bg-gray-50 dark:hover:bg-gray-700/50"
                >
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                    {payment.date}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                    {payment.amount}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-300">
                      {payment.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-blue-600 dark:text-blue-400">
                    <button className="hover:underline">{payment.invoice}</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};