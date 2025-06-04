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
        background: "linear-gradient(135deg, #172041, #1D1C56)",
        color: "#ffffff",
        pt: 15,
        pb:10
      }}
    >
      <Container maxWidth="md">
        <Typography variant="h4" gutterBottom>
          Data Deletion Policy 
        </Typography>

        <Typography variant="body1" gutterBottom>
          How to Delete Your Facebook User Data from Our Tool
        </Typography>

        <Typography variant="body2" gutterBottom>
          We respect your privacy and give you full control over your data. If you’ve signed in using Facebook and wish to delete your data from our system, please follow the steps below:
        </Typography>

        <Box mt={4}>
          <Typography variant="h6" gutterBottom>
            🧾 Steps to Delete Your Account:
          </Typography>
          <List>
            <ListItem>
              <ListItemIcon sx={{ color: "#ffffff" }}><Delete /></ListItemIcon>
              <ListItemText primary="Sign in to your account using the same Facebook account you used to register." />
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
              <ListItemText primary="All your personal information, including your Facebook user ID, will be permanently removed from our database." />
            </ListItem>
            <ListItem>
              <ListItemIcon sx={{ color: "#ffffff" }}><Lock /></ListItemIcon>
              <ListItemText primary="You will no longer have access to your data or services linked to that account." />
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
