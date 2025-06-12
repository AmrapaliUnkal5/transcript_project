import { Box, styled, TextField, Typography } from '@mui/material';
import React from 'react';
import Grid from '@mui/material/Grid2';
import { Facebook, Apple } from 'lucide-react';
import { Link } from 'react-router-dom';
import Hero from './Hero';
import DashboardPreview from './DashboardPreview';
import StartBuilding from './StartBuilding';
import BotDataControl from './BotDataControl';
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
      <DashboardPreview/>
      <BotDataControl/>
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


