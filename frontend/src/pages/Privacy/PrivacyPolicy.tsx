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

export const PrivacyPolicy = () => {
  return (
    <Box
      sx={{
        background: "linear-gradient(135deg, #172041, #1D1C56)",
        color: "#ffffff",
        pt:15,
        pb:10,
        minHeight: "100vh",
      }}
    >
      <Container maxWidth="md">
       
          <Typography variant="h4" gutterBottom>
            Privacy Policy & Terms and Conditions
          </Typography>

          <Typography variant="body2" gutterBottom>
            Last Updated: 15Mar 2025
          </Typography>

          <Box mt={4}>
            <Typography variant="h6">1. Acceptance of Terms</Typography>
            <Typography variant="body1">
              By using our website and services, you acknowledge that you have read, understood,
              and agreed to be bound by these Terms. You must be legally capable of entering into a
              contract.
            </Typography>
          </Box>

          <Box mt={3}>
            <Typography variant="h6">2. Scope of Services</Typography>
            <Typography variant="body1">
              Our website offers various services, including AI chatbot solutions, subscription-based
              software services, and online transactions through a payment gateway. We reserve the
              right to modify, suspend, or discontinue any part of the Services at any time without
              prior notice.
            </Typography>
          </Box>

          <Box mt={3}>
            <Typography variant="h6">3. Eligibility</Typography>
            <List>
              <ListItem>
                <ListItemText primary="Be at least 18 years old." />
              </ListItem>
              <ListItem>
                <ListItemText primary="Provide accurate and complete registration and payment information." />
              </ListItem>
              <ListItem>
                <ListItemText primary="Comply with all applicable laws and regulations." />
              </ListItem>
            </List>
          </Box>

          <Box mt={3}>
            <Typography variant="h6">4. Intellectual Property Rights</Typography>
            <Typography variant="body1">
              All content is owned by BytePX Technologies Pvt. Ltd. and protected by IP laws. You may not use
              any of our materials without written permission.
            </Typography>
          </Box>

          <Box mt={3}>
            <Typography variant="h6">5. User Conduct</Typography>
            <List>
              <ListItem>
                <ListItemText primary="Do not use Services for fraudulent or unlawful activities." />
              </ListItem>
              <ListItem>
                <ListItemText primary="Respect intellectual property and privacy rights." />
              </ListItem>
              <ListItem>
                <ListItemText primary="Do not interfere with our website or payment gateway operations." />
              </ListItem>
            </List>
          </Box>

          <Box mt={3}>
            <Typography variant="h6">6. Privacy Policy and Data Security</Typography>
            <Typography variant="body1">
              We prioritize your data security but are not responsible for issues caused by
              third-party payment gateways. We do not store sensitive payment data.
            </Typography>
          </Box>

          <Box mt={3}>
            <Typography variant="h6">7. Third-Party Terms and Payment Gateway Integration</Typography>
            <Typography variant="body1">
              Transactions are handled by third-party providers with their own terms and policies.
              We are not liable for their actions.
            </Typography>
          </Box>

          <Box mt={3}>
            <Typography variant="h6">8. Payment Methodology and Subscription Model</Typography>
            <Typography variant="body1">
              Subscriptions auto-renew monthly unless cancelled. Supported methods include cards,
              UPI, net banking, and wallets.
            </Typography>
          </Box>

          <Box mt={3}>
            <Typography variant="h6">9. Subscription Management and Auto-Renewal</Typography>
            <Typography variant="body1">
              You must cancel 48 hours prior to renewal to stop auto-billing. Charges are
              non-refundable once debited.
            </Typography>
          </Box>

          <Box mt={3}>
            <Typography variant="h6">10. Fees, Charges, and Taxes</Typography>
            <Typography variant="body1">
              Additional charges may apply based on your bank or provider. We are not liable for
              external fees.
            </Typography>
          </Box>

          <Box mt={3}>
            <Typography variant="h6">11. Refunds, Disputes, and Unauthorized Transactions</Typography>
            <Typography variant="body1">
              Refunds are handled by service providers. Report disputes or fraud directly to them.
              We will support where possible.
            </Typography>
          </Box>

          <Box mt={3}>
            <Typography variant="h6">12. Security and Fraud Prevention</Typography>
            <Typography variant="body1">
              Transactions are encrypted. Accounts suspected of fraud may be suspended.
            </Typography>
          </Box>

          <Box mt={3}>
            <Typography variant="h6">13. Limitations of Liability</Typography>
            <Typography variant="body1">
              We are not liable for third-party failures or indirect damages. Our liability is
              limited to the payment made for the disputed service.
            </Typography>
          </Box>

          <Box mt={3}>
            <Typography variant="h6">14. User Responsibilities</Typography>
            <List>
              <ListItem>
                <ListItemText primary="Keep payment details accurate." />
              </ListItem>
              <ListItem>
                <ListItemText primary="Keep your account credentials secure." />
              </ListItem>
              <ListItem>
                <ListItemText primary="Ensure sufficient funds for subscription payments." />
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
