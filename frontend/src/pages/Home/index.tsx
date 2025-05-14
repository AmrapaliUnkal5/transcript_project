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
import Footer from './Footer';

export default function HomePage() {
  return (
    <Box>
      <HomeHeader/>
      <Hero/>
      <DashboardPreview/>
      <ExperienceAdvantage/>
      <BotDataControl/>
      <StartBuilding/>
      <Footer/>
      
    </Box>
  );
}


