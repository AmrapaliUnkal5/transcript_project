import { Box, styled, TextField, Typography } from '@mui/material';
import React from 'react';

import HomeHeader from './Header';
import Hero from './Hero';

import ExperienceAdvantage from './ExperienceAdvantage';

 
import Footer from './Footer';
import FAQ from './FAQ';
import { Enterprise } from './Enterprise';
import CustomizeExperience from './CustomizeExperience';
import PricePlans from './PricePlans';
import AddonExperience from './AddonExperience';



export default function OurPlans() {
  return (
    <Box>
      <HomeHeader/>
      <Hero/>
      <PricePlans/>
      <Enterprise/>
      <CustomizeExperience/>
      <AddonExperience/>
      <FAQ/>
      <Footer/> 
      
    </Box>
  );
}


