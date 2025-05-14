import { Box, styled, TextField, Typography } from '@mui/material';
import React from 'react';
import Grid from '@mui/material/Grid2';
import { Facebook, Apple } from 'lucide-react';
import { Link } from 'react-router-dom';
import HomeHeader from './Header';
import Hero from './Hero';
import DashboardPreview from './DashboardPreview';
import StartBuilding from './StartBuilding';
import BotDataControl from './BotDataControl';
import ExperienceAdvantage from './ExperienceAdvantage';
import KeyBenefits from './KeyBenefits';
import Plans from './Plans';
import Footer from './Footer';
import FAQ from './FAQ';
//import { Enterprise } from './Enterprise';

export default function HomePage() {
  return (
    <Box>
      <HomeHeader/>
      <Hero/>
      <DashboardPreview/>
      <ExperienceAdvantage/>
      <KeyBenefits/>
      <Plans/>
      <BotDataControl/>
      <FAQ/>
      <StartBuilding/>
      <Footer/> 
      
    </Box>
  );
}


