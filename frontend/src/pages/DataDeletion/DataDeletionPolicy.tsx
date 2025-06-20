import React from "react";
import {
  Container,
  Typography,
  Box,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Divider,
} from "@mui/material";
import { Delete, Lock, Help } from "@mui/icons-material";

export const DataDeletionPolicy = () => {
  return (
    <Box
      sx={{
         backgroundColor: "#101035", 
        color: "#ffffff",
        pt: 15,
        pb: 10,
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
                        mb={1}
                        sx={{
                            background: 'linear-gradient(180deg, #FFFFFF 46.63%, #959595 100%)',
                            backgroundClip: 'text',
                            textFillColor: 'transparent',
                          }}
                    >
                        Data Deletion Policy
                      </Typography>

        <Typography variant="h6" mt={[2,6]} mb={[0,2]} justifyContent={"center"} gutterBottom>
          How to Delete Your User Data from Our Tool
        </Typography>

        <Typography variant="body2" gutterBottom>
          We respect your privacy and give you full control over your data. If you wish to delete your account and all associated data from our system, please follow the steps below:
        </Typography>

        <Box mt={4}>
          <Typography variant="h6" gutterBottom>
            🧾 Steps to Delete Your Account:
          </Typography>
          <List>
            <ListItem>
              <ListItemIcon sx={{ color: "#ffffff" }}><Delete /></ListItemIcon>
              <ListItemText primary="Sign in to your account using your registered login credentials." />
            </ListItem>
            <ListItem>
              <ListItemIcon sx={{ color: "#ffffff" }}><Delete /></ListItemIcon>
              <ListItemText primary="Navigate to the My Account page by clicking on your profile on the right-hand side." />
            </ListItem>
            <ListItem>
              <ListItemIcon sx={{ color: "#ffffff" }}><Delete /></ListItemIcon>
              <ListItemText primary="Click on 'Delete Account' at the bottom of the My Account page." />
            </ListItem>
            <ListItem>
              <ListItemIcon sx={{ color: "#ffffff" }}><Delete /></ListItemIcon>
              <ListItemText primary="Confirm the deletion request when prompted." />
            </ListItem>
          </List>
        </Box>

        <Box mt={4}>
          <Typography variant="h6" gutterBottom>
            🔐 What happens next?
          </Typography>
          <List>
            <ListItem>
              <ListItemIcon sx={{ color: "#ffffff" }}><Lock /></ListItemIcon>
              <ListItemText primary="All your personal information and associated data will be permanently removed from our database." />
            </ListItem>
            <ListItem>
              <ListItemIcon sx={{ color: "#ffffff" }}><Lock /></ListItemIcon>
              <ListItemText primary="You will no longer have access to your data or services linked to your account." />
            </ListItem>
          </List>
        </Box>

        <Box mt={4}>
          <Typography variant="h6" gutterBottom>
            📌 Need Help?
          </Typography>
          <List>
            <ListItem>
              <ListItemIcon sx={{ color: "#ffffff" }}><Help /></ListItemIcon>
              <ListItemText primary="If you’re unable to access your account or have any concerns, feel free to reach out to our support team via the Contact Us page." />
            </ListItem>
          </List>
        </Box>

        <Divider sx={{ my: 4, backgroundColor: "rgba(255,255,255,0.3)" }} />

        <Typography variant="body2" align="center">
          © {new Date().getFullYear()} All rights reserved. BytePX Technologies Pvt. Ltd.
        </Typography>
      </Container>
    </Box>
  );
};

