import { Box, styled, } from '@mui/material';
import React from 'react';

import Hero from './Hero';
import Footer from './Footer';
import FAQ from './FAQ';
import { Enterprise } from './Enterprise';
import CustomizeExperience from './CustomizeExperience';
import PricePlans from './PricePlans';
import AddonExperience from './AddonExperience';
import { OurplanTable} from './OurplanTable';
import HomeHeader from '../../components/Header/Header';



export default function OurPlans() {
  return (
    <Box>
      <HomeHeader/>
      <Hero/>
      <PricePlans/>
      <Enterprise/>
      <CustomizeExperience/>
      <AddonExperience/>
      
      <OurplanTable/>
      <FAQ/>
      
      <Footer/> 

      
    </Box>
  );
}


