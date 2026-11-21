'use client';

import { useState } from 'react';
import Navbar from '../components/Navbar';
import HeroSection from '../components/HeroSection';
import ServicesGrid from '../components/ServicesGrid';
import BookingModule from '../components/BookingModule';
import TeamSection from '../components/TeamSection';
import TestimonialsSection from '../components/TestimonialsSection';
import FAQSection from '../components/FAQSection';
import Footer from '../components/Footer';
import AIAssistantWidget from '../components/AIAssistantWidget';

export default function Home() {
  const [isAIOpen, setIsAIOpen] = useState(false);

  const toggleAI = () => {
    setIsAIOpen((prev) => !prev);
  };

  return (
    <>
      <Navbar onOpenAI={() => setIsAIOpen(true)} />
      <main>
        <HeroSection onOpenAI={() => setIsAIOpen(true)} />
        <ServicesGrid />
        <BookingModule />
        <TeamSection />
        <TestimonialsSection />
        <FAQSection onOpenAI={() => setIsAIOpen(true)} />
      </main>
      <Footer />
      <AIAssistantWidget isOpen={isAIOpen} setIsOpen={setIsAIOpen} />
    </>
  );
}
