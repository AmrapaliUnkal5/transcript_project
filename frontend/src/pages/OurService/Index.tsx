
import React from 'react';
import { Box, Fab, styled, } from '@mui/material';
import Footer from '../../components/Footer/Footer';
import HomeHeader from '../../components/Header/Header';
import Top from './Top';
import StartBuilding from './StartBuilding';
import PageLink from './PageLink';


export default function OurServices() {
  return (
    <Box>
      <HomeHeader/>
      <Top/>
      <PageLink/>
     <StartBuilding/>
      <Footer/> 
    </Box>
  );
}


