import { useEffect, useRef, useState } from 'react';
import { Box, Text, VStack } from '@chakra-ui/react';

export const LoginButton = ({ onClick }) => {
  const buttonRef = useRef(null);
  const [googleReady, setGoogleReady] = useState(false);
  const [renderAttempted, setRenderAttempted] = useState(false);

  useEffect(() => {
    let timeoutId;
    let retryCount = 0;
    const maxRetries = 10;

    const tryRender = () => {
      if (!buttonRef.current) return;

      if (window.google?.accounts?.id) {
        try {
          window.google.accounts.id.renderButton(
            buttonRef.current,
            {
              theme: 'outline',
              size: 'large',
              text: 'signin_with',
              shape: 'rectangular',
              logo_alignment: 'left',
              width: 300,
            }
          );

          setGoogleReady(true);
          setRenderAttempted(true);

          // Check if button actually has content after 500ms
          setTimeout(() => {
            const hasContent = buttonRef.current?.querySelector('iframe') ||
                              buttonRef.current?.querySelector('div[role="button"]') ||
                              (buttonRef.current?.children?.length > 0);

            if (!hasContent) {
              setGoogleReady(false);
            }
          }, 500);

        } catch (error) {
          console.error('Failed to render Google button:', error);
          setRenderAttempted(true);
        }
      } else {
        retryCount++;
        if (retryCount < maxRetries) {
          timeoutId = setTimeout(tryRender, 200);
        } else {
          console.error('Google SDK failed to load');
          setRenderAttempted(true);
        }
      }
    };

    tryRender();

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, []);

  return (
    <Box position="relative" zIndex={10}>
      <Box
        ref={buttonRef}
        minH="44px"
        sx={{
          '& > div': {
            margin: '0 auto !important',
            display: 'flex !important',
            justifyContent: 'center !important',
          },
          '& iframe': {
            display: 'block !important',
            visibility: 'visible !important',
            opacity: '1 !important',
          }
        }}
      />

      {renderAttempted && !googleReady && (
        <VStack
          spacing={3}
          mt={4}
          p={4}
          bg="rgba(254, 178, 178, 0.1)"
          borderRadius="md"
          borderWidth="1px"
          borderColor="red.500"
        >
          <Text color="red.300" fontSize="sm" fontWeight="bold">
            Unable to load Google Sign-In
          </Text>
          <Text color="gray.300" fontSize="xs" textAlign="center">
            This may be due to:
          </Text>
          <VStack spacing={1} fontSize="xs" color="gray.400" align="start" w="full">
            <Text>• Ad blocker or privacy extension blocking Google</Text>
            <Text>• Network/firewall restrictions</Text>
            <Text>• Browser compatibility issue</Text>
          </VStack>
          <Text color="gray.400" fontSize="xs" textAlign="center" mt={2}>
            Try disabling ad blockers or use Chrome/Safari
          </Text>
        </VStack>
      )}
    </Box>
  );
};
