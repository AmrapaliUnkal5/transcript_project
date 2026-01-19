import { Box } from '@mui/material';
import React from 'react';
import Hero from './Hero';
import StartBuilding from './StartBuilding';
import ExperienceAdvantage from './ExperienceAdvantage';
import KeyBenefits from './KeyBenefits';
import Plans from './Plans';
import Footer from '../../components/Footer/Footer';
import FAQ from './FAQ';
import { Enterprise } from './Enterprise';
import HomeHeader from '../../components/Header/Header';
import FourStage from './FourStage';

export default function HomePage() {
  return (
    <Box>
      <HomeHeader/>
      <Hero/>
      <FourStage/>
      <ExperienceAdvantage/>
      <KeyBenefits/>
      <Plans/>
      <Enterprise/>
      <FAQ/>
      <StartBuilding/>
      <Footer/> 
      
    </Box>
  );
}


