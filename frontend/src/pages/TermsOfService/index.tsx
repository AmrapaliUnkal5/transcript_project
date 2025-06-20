import { Box, styled, } from '@mui/material';
import React from 'react';
import HomeHeader from '../../components/Header/Header';
import Footer from '../../components/Footer/Footer';
import { TermsOfService } from './TermsOfService';
import PageBottom from './PageBottom';



export default function TermsService() {
    return (
        <Box>
        <HomeHeader/>
        <TermsOfService/>
        <PageBottom/>
        <Footer/> 
        </Box>
    );
}