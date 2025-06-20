import React from "react";
import {
  Container,
  Typography,
  Box,
  List,
  ListItem,
  ListItemText,
  Divider,
} from "@mui/material";

export const CancellationRefundPolicy = () => {
  return (
    <Box  sx={{
    backgroundColor: "#101035", 
    color: "#ffffff",
    pt: 15,
    pb:10,
    fontFamily: "'Instrument Sans', sans-serif",
  }}>
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
                Cancellation & Refund Policy
              </Typography>

        <Typography variant="body2" align="center" mb={[0,4]}>
          Effective Date: 15 Mar 2025
        </Typography>

        <Box mt={4}>
          <Typography variant="h6">🔄 1. Cancellation Policy</Typography>

          <Typography variant="subtitle1" mt={2}>
            a. Subscription Plans
          </Typography>
          <List>
            <ListItem>
              <ListItemText primary="You may cancel your monthly or annual subscription at any time through your account dashboard or by emailing support@evolra.ai." />
            </ListItem>
            <ListItem>
              <ListItemText primary="Upon cancellation, your account will remain active until the end of your current billing cycle." />
            </ListItem>
            <ListItem>
              <ListItemText primary="No additional charges will be applied after the current billing cycle ends." />
            </ListItem>
          </List>

          <Typography variant="subtitle1" mt={2}>
            b. Custom Plans or One-Time Projects
          </Typography>
          <List>
            <ListItem>
              <ListItemText primary="Cancellations must be requested within 24 hours of order confirmation to receive a full refund." />
            </ListItem>
            <ListItem>
              <ListItemText primary="Partial refunds after 24 hours depend on the stage of development." />
            </ListItem>
          </List>
        </Box>

        <Box mt={4}>
          <Typography variant="h6">💸 2. Refund Policy</Typography>

          <Typography variant="subtitle1" mt={2}>
            a. Standard Refund Window
          </Typography>
          <List>
            <ListItem>
              <ListItemText primary="7-day refund guarantee on all subscription plans." />
            </ListItem>
            <ListItem>
              <ListItemText primary="Refund requests must be made within 7 days of the initial purchase." />
            </ListItem>
            <ListItem>
              <ListItemText primary="Refunds processed to the original payment method within 7–10 business days." />
            </ListItem>
          </List>

          <Typography variant="subtitle1" mt={2}>
            b. Refunds After 7 Days
          </Typography>
          <List>
            <ListItem>
              <ListItemText primary="Generally not issued unless due to technical issues unresolved by support or billing errors." />
            </ListItem>
          </List>

          <Typography variant="subtitle1" mt={2}>
            c. Custom or Enterprise Projects
          </Typography>
          <List>
            <ListItem>
              <ListItemText primary="Handled case-by-case depending on project scope and completion status." />
            </ListItem>
            <ListItem>
              <ListItemText primary="Service fees may apply if development has started." />
            </ListItem>
          </List>
        </Box>

        <Box mt={4}>
          <Typography variant="h6">🚫 Non-Refundable Items</Typography>
          <List>
            <ListItem>
              <ListItemText primary="Setup or onboarding fees (if any)" />
            </ListItem>
            <ListItem>
              <ListItemText primary="Add-on features delivered and consumed" />
            </ListItem>
            <ListItem>
              <ListItemText primary="Usage-based charges (e.g., API credits consumed)" />
            </ListItem>
          </List>
        </Box>

        <Box mt={4}>
          <Typography variant="h6">📬 How to Request a Refund</Typography>
          <Typography variant="body1">
            To request a refund, please email us at <strong>support@evolra.ai</strong> with the following:
          </Typography>
          <List>
            <ListItem>
              <ListItemText primary="Your registered email ID" />
            </ListItem>
            <ListItem>
              <ListItemText primary="Date of purchase" />
            </ListItem>
            <ListItem>
              <ListItemText primary="Reason for cancellation/refund" />
            </ListItem>
          </List>
        </Box>

        <Box mt={4}>
          <Typography variant="h6">📝 Policy Changes</Typography>
          <Typography variant="body1">
            Evolra.ai reserves the right to modify this policy at any time. Changes will be reflected on this page with an updated effective date.
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
