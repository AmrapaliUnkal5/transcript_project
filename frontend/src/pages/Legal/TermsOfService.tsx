import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

export const TermsOfService = () => {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        <div className="mb-8">
          {/* <Link
            to="/signup"
            className="inline-flex items-center text-sm text-blue-600 hover:text-blue-500"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Sign Up
          </Link> */}
        </div>
       
        <div className="bg-white dark:bg-gray-800 shadow rounded-lg px-8 py-6">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-6">
            Terms of Service
          </h1>
         
          <div className="prose dark:prose-invert max-w-none">
            <p className="text-gray-600 dark:text-gray-300 mb-6">
              Last updated: May 15, 2025
            </p>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
                1. Acceptance of Terms
              </h2>
              <p className="text-gray-600 dark:text-gray-300">
                By accessing and using this website, you accept and agree to be bound by the terms
                and provision of this agreement. If you do not agree to abide by the above, please
                do not use this service.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
                2. Use License
              </h2>
              <ul className="list-disc pl-6 text-gray-600 dark:text-gray-300 space-y-2">
                <li>
                  Permission is granted to temporarily download one copy of the materials for personal,
                  non-commercial transitory viewing only.
                </li>
                <li>
                  This is the grant of a license, not a transfer of title, and under this license you may not:
                  <ul className="list-circle pl-6 mt-2 space-y-1">
                    <li>Modify or copy the materials</li>
                    <li>Use the materials for any commercial purpose</li>
                    <li>Transfer the materials to another person</li>
                    <li>Attempt to decompile or reverse engineer any software</li>
                  </ul>
                </li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
                3. Disclaimer
              </h2>
              <p className="text-gray-600 dark:text-gray-300">
                The materials on this website are provided on an 'as is' basis. We make no
                warranties, expressed or implied, and hereby disclaim and negate all other warranties
                including, without limitation, implied warranties or conditions of merchantability,
                fitness for a particular purpose, or non-infringement of intellectual property or
                other violation of rights.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
                4. Limitations
              </h2>
              <p className="text-gray-600 dark:text-gray-300">
                In no event shall we or our suppliers be liable for any damages (including, without
                limitation, damages for loss of data or profit, or due to business interruption)
                arising out of the use or inability to use the materials on our website.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
                5. Governing Law
              </h2>
              <p className="text-gray-600 dark:text-gray-300">
                These terms and conditions are governed by and construed in accordance with the laws
                and you irrevocably submit to the exclusive jurisdiction of the courts in that location.
              </p>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
};
