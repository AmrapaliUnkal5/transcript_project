import React from "react";
import { Container, Typography, Box, Divider, List, ListItem, ListItemText } from "@mui/material";

export const TermsOfService = () => {
  return (
    <Box
         sx={{
        backgroundColor: "#101035", 
        color: "#ffffff",
        pt: 15,
        pb:10,
        fontFamily: "'Instrument Sans', sans-serif",
      }}
    >
      <Container maxWidth="md">

          <Typography 
                  variant='h2' 
                  fontWeight={600} 
                  fontSize={['30px', '54px']} 
                  color='#fff'
                  textAlign={'center'}
                  sx={{
                      background: 'linear-gradient(180deg, #FFFFFF 46.63%, #959595 100%)',
                      backgroundClip: 'text',
                      textFillColor: 'transparent',
                    }}
              >
                 Terms of Service
                </Typography>

          <Typography variant="body2" align="center" gutterBottom>
            Last updated: May 15, 2025
          </Typography>

          <Box mt={4}>
            <Typography variant="h6" gutterBottom>
              1. Acceptance of Terms
            </Typography>
            <Typography variant="body1" gutterBottom>
              By accessing and using this website, you accept and agree to be bound by the terms and
              provision of this agreement. If you do not agree to abide by the above, please do not
              use this service.
            </Typography>
          </Box>

          <Box mt={4}>
            <Typography variant="h6" gutterBottom>
              2. Use License
            </Typography>
            <List sx={{ pl: 2 }}>
              <ListItem>
                <ListItemText
                  primary="Permission is granted to temporarily download one copy of the materials for personal,
                non-commercial transitory viewing only."
                />
              </ListItem>
              <ListItem>
                <ListItemText
                  primary="This is the grant of a license, not a transfer of title, and under this license you may not:"
                />
              </ListItem>
              <List sx={{ pl: 4, listStyleType: "circle" }}>
                <ListItem sx={{ display: "list-item" }}>
                  <ListItemText primary="Modify or copy the materials" />
                </ListItem>
                <ListItem sx={{ display: "list-item" }}>
                  <ListItemText primary="Use the materials for any commercial purpose" />
                </ListItem>
                <ListItem sx={{ display: "list-item" }}>
                  <ListItemText primary="Transfer the materials to another person" />
                </ListItem>
                <ListItem sx={{ display: "list-item" }}>
                  <ListItemText primary="Attempt to decompile or reverse engineer any software" />
                </ListItem>
              </List>
            </List>
          </Box>

          <Box mt={4}>
            <Typography variant="h6" gutterBottom>
              3. Disclaimer
            </Typography>
            <Typography variant="body1">
              The materials on this website are provided on an 'as is' basis. We make no warranties,
              expressed or implied, and hereby disclaim and negate all other warranties including,
              without limitation, implied warranties or conditions of merchantability, fitness for a
              particular purpose, or non-infringement of intellectual property or other violation of
              rights.
            </Typography>
          </Box>

          <Box mt={4}>
            <Typography variant="h6" gutterBottom>
              4. Limitations
            </Typography>
            <Typography variant="body1">
              In no event shall we or our suppliers be liable for any damages (including, without
              limitation, damages for loss of data or profit, or due to business interruption)
              arising out of the use or inability to use the materials on our website.
            </Typography>
          </Box>

          <Box mt={4}>
            <Typography variant="h6" gutterBottom>
              5. Governing Law
            </Typography>
            <Typography variant="body1">
              These terms and conditions are governed by and construed in accordance with the laws
              and you irrevocably submit to the exclusive jurisdiction of the courts in that
              location.
            </Typography>
          </Box>

          <Divider sx={{ my: 4, backgroundColor: "rgba(255,255,255,0.3)" }} />

          <Typography variant="body2" align="center">
            © {new Date().getFullYear()} All rights reserved. BytePX Technologies Pvt. Ltd.
          </Typography>
      
      </Container>
    </Box>
  );
};

