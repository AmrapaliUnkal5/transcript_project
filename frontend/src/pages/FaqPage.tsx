import React, { useState } from "react";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { useNavigate } from "react-router-dom";
//import { authApi } from "../../services/api"; 
//import { DemoRequestData } from "../../types"; 

export const FAQ = () => {
    const [openIndex, setOpenIndex] = useState<number | null>(null);

    const faqs = [
      { question: "What is this service about?", answer: "Details coming soon." },
      { question: "How can I contact support?", answer: "Support details will be provided by the client." },
      { question: "Is there a free trial available?", answer: "Trial details will be updated soon." },
    ];
  
    const toggleFAQ = (index: number) => {
      setOpenIndex(openIndex === index ? null : index);
    };
  
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-2xl w-full bg-white p-8 rounded-lg shadow-lg">
          <h2 className="text-3xl font-extrabold text-gray-900 text-center mb-6">Frequently Asked Questions</h2>
          <div className="space-y-4">
            {faqs.map((faq, index) => (
              <div key={index} className="border border-gray-200 rounded-md">
                <button
                  className="w-full text-left p-4 font-medium text-gray-900 flex justify-between items-center"
                  onClick={() => toggleFAQ(index)}
                >
                  {faq.question}
                  <span>{openIndex === index ? "-" : "+"}</span>
                </button>
                {openIndex === index && <p className="p-4 text-gray-700">{faq.answer}</p>}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };