import { Box, styled, } from '@mui/material';
import React from 'react';

import Hero from './Hero';
import Footer from '../../components/Footer/Footer';
import FAQ from './FAQ';
import { Enterprise } from './Enterprise';
import CustomizeExperience from './CustomizeExperience';
import PricePlans from './PricePlans';
import AddonExperience from './AddonExperience';
import { OurplanTable} from './OurplanTable';
import HomeHeader from '../../components/Header/Header';
import { getBackgroundImageUrl } from '../../utils/imagePath';



export default function OurPlans() {
  return (
    <Box>
      <HomeHeader/>
      <Box
        sx={{
          backgroundImage: getBackgroundImageUrl("images/home/op-hero-bg.png"),
          backgroundSize: 'contain',
         // backgroundPosition: "center",
         backgroundRepeat: 'no-repeat',
          backgroundColor: "#101035",
        }}>
        <Hero/>
        <PricePlans/>
      </Box>
      <Enterprise/>
      <CustomizeExperience/>
      <AddonExperience/>
      
      <OurplanTable/>
      <FAQ/>
      
      <Footer/> 

      
    </Box>
  );
}


