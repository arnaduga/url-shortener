import { useState } from 'react';
import {
  Box,
  VStack,
  FormControl,
  FormLabel,
  Input,
  Switch,
  NumberInput,
  NumberInputField,
  NumberInputStepper,
  NumberIncrementStepper,
  NumberDecrementStepper,
  Button,
  useToast,
  Text,
  InputGroup,
  InputRightElement,
  IconButton,
  HStack,
  Tooltip,
  useDisclosure,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalFooter,
  ModalBody,
  ModalCloseButton,
  Code,
  Link,
  Heading,
  Collapse,
  SimpleGrid,
} from '@chakra-ui/react';
import { FiCopy, FiExternalLink, FiAlertCircle, FiChevronDown, FiChevronUp, FiSliders } from 'react-icons/fi';
import { useApi } from '../hooks/useApi';

export const UrlShortenerForm = () => {
  const { apiCall } = useApi();
  const [longUrl, setLongUrl] = useState('');
  const [humanReadable, setHumanReadable] = useState(true);
  const [ttl, setTtl] = useState(7);
  const [isLoading, setIsLoading] = useState(false);
  const [shortUrl, setShortUrl] = useState('');
  const [errorDetails, setErrorDetails] = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  const toast = useToast();
  const { isOpen, onOpen, onClose } = useDisclosure();

  // URL validation regex
  const isValidUrl = (url) => {
    try {
      const urlPattern = /^https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)$/;
      return urlPattern.test(url);
    } catch (error) {
      return false;
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validate URL is not empty
    if (!longUrl.trim()) {
      toast({
        title: 'Error',
        description: 'Please enter a URL',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
      return;
    }

    // Validate URL format
    if (!isValidUrl(longUrl)) {
      toast({
        title: 'Invalid URL',
        description: 'Please enter a valid URL starting with http:// or https://',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
      return;
    }

    setIsLoading(true);
    setShortUrl('');

    try {
      const response = await apiCall('/create', {
        method: 'POST',
        body: JSON.stringify({
          long_url: longUrl,
          human_readable: humanReadable,
          ttl_in_days: ttl,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create short URL');
      }

      const data = await response.json();
      setShortUrl(data.short_url);

      // Calculate expiration message
      let expirationMessage = 'Short URL created successfully!';
      if (ttl > 0) {
        const expirationDate = new Date();
        expirationDate.setDate(expirationDate.getDate() + ttl);
        expirationMessage += ` Expires on ${expirationDate.toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        })}.`;
      } else {
        expirationMessage += ' This link will never expire.';
      }

      toast({
        title: 'Success',
        description: expirationMessage,
        status: 'success',
        duration: 5000,
        isClosable: true,
      });

      // Reset form
      setLongUrl('');
      setHumanReadable(true);
      setTtl(7);
    } catch (error) {
      const errorInfo = {
        message: error.message,
        timestamp: new Date().toISOString(),
        endpoint: `${API_ENDPOINT}/create`,
        method: 'POST',
        stack: error.stack,
      };
      setErrorDetails(errorInfo);

      toast({
        title: 'Failed to create short URL',
        description: (
          <Box>
            <Text>{error.message}</Text>
            <Link
              color="black"
              textDecoration="underline"
              cursor="pointer"
              onClick={onOpen}
              mt={2}
              display="inline-block"
            >
              More...
            </Link>
          </Box>
        ),
        status: 'error',
        duration: 8000,
        isClosable: true,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(shortUrl);
    toast({
      title: 'Copied!',
      description: 'URL copied to clipboard',
      status: 'success',
      duration: 2000,
      isClosable: true,
    });
  };

  return (
    <>
    <Box
      bg="rgba(26, 32, 44, 0.6)"
      backdropFilter="blur(10px)"
      p={6}
      borderRadius="lg"
      boxShadow="2xl"
      borderWidth="1px"
      borderColor="whiteAlpha.200"
    >
      <VStack spacing={6} align="stretch">
        <Heading size="md">Create Short Link</Heading>

        <form onSubmit={handleSubmit}>
          <VStack spacing={6} align="stretch">
            <FormControl>
              <FormLabel>Long URL</FormLabel>
            <Input
              placeholder="https://example.com/very-long-url"
              value={longUrl}
              onChange={(e) => setLongUrl(e.target.value)}
              bg="gray.700"
              border="none"
              _focus={{ bg: 'gray.700', ring: 2, ringColor: 'blue.500' }}
            />
          </FormControl>

          <Box>
            <Button
              onClick={() => setShowSettings(!showSettings)}
              variant="ghost"
              size="sm"
              leftIcon={<FiSliders />}
              rightIcon={showSettings ? <FiChevronUp /> : <FiChevronDown />}
              color="gray.400"
              _hover={{ color: 'white', bg: 'gray.700' }}
              mb={2}
            >
              Settings
            </Button>

            <Collapse in={showSettings} animateOpacity>
              <Box
                p={4}
                bg="gray.700"
                borderRadius="md"
                borderWidth="1px"
                borderColor="gray.600"
              >
                <SimpleGrid columns={{ base: 1, md: 2 }} spacing={6}>
                  <HStack spacing={3} justify="flex-start">
                    <FormLabel mb="0" minW="fit-content">Human Readable</FormLabel>
                    <Switch
                      colorScheme="blue"
                      isChecked={humanReadable}
                      onChange={(e) => setHumanReadable(e.target.checked)}
                    />
                  </HStack>

                  <FormControl>
                    <FormLabel mb={2} fontSize="sm">Expiration (days)</FormLabel>
                    <HStack spacing={2}>
                      <NumberInput
                        min={0}
                        max={3650}
                        value={ttl}
                        onChange={(valueString) => setTtl(Number(valueString))}
                        maxW="120px"
                      >
                        <NumberInputField
                          bg="gray.600"
                          border="none"
                          _focus={{ bg: 'gray.600', ring: 2, ringColor: 'blue.500' }}
                        />
                        <NumberInputStepper>
                          <NumberIncrementStepper border="none" />
                          <NumberDecrementStepper border="none" />
                        </NumberInputStepper>
                      </NumberInput>
                      <Text fontSize="xs" color="gray.400" whiteSpace="nowrap">0 = never</Text>
                    </HStack>
                  </FormControl>
                </SimpleGrid>
              </Box>
            </Collapse>
          </Box>

          <Button
            type="submit"
            colorScheme="blue"
            size="lg"
            isLoading={isLoading}
            loadingText="Creating..."
          >
            Create Short URL
          </Button>

          {shortUrl && (
            <Box p={4} bg="gray.700" borderRadius="md" borderWidth="1px" borderColor="green.500">
              <Text fontSize="sm" color="gray.400" mb={2}>
                Your short URL:
              </Text>
              <InputGroup size="lg">
                <Input
                  value={shortUrl}
                  isReadOnly
                  bg="gray.800"
                  border="none"
                  pr="100px"
                />
                <InputRightElement width="100px">
                  <HStack spacing={1}>
                    <Tooltip label="Copy to clipboard">
                      <IconButton
                        icon={<FiCopy />}
                        onClick={copyToClipboard}
                        size="sm"
                        variant="ghost"
                        _hover={{ bg: 'gray.600' }}
                      />
                    </Tooltip>
                    <Tooltip label="Open in new tab">
                      <IconButton
                        as="a"
                        href={shortUrl}
                        target="_blank"
                        icon={<FiExternalLink />}
                        size="sm"
                        variant="ghost"
                        _hover={{ bg: 'gray.600' }}
                      />
                    </Tooltip>
                  </HStack>
                </InputRightElement>
              </InputGroup>
            </Box>
          )}
          </VStack>
        </form>
      </VStack>
    </Box>

    <Modal isOpen={isOpen} onClose={onClose} size="xl" isCentered>
      <ModalOverlay backdropFilter="blur(4px)" />
      <ModalContent bg="gray.800" borderColor="red.500" borderWidth="2px">
        <ModalHeader>
          <HStack>
            <FiAlertCircle color="red" />
            <Text>Error Details</Text>
          </HStack>
        </ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          {errorDetails && (
            <VStack align="stretch" spacing={4}>
              <Box>
                <Text fontWeight="bold" mb={2} color="gray.400" fontSize="sm">
                  Error Message:
                </Text>
                <Code
                  colorScheme="red"
                  p={3}
                  borderRadius="md"
                  display="block"
                  whiteSpace="pre-wrap"
                  bg="red.900"
                  color="red.100"
                >
                  {errorDetails.message}
                </Code>
              </Box>

              <Box>
                <Text fontWeight="bold" mb={2} color="gray.400" fontSize="sm">
                  Endpoint:
                </Text>
                <Code p={3} borderRadius="md" display="block" bg="gray.700">
                  {errorDetails.method} {errorDetails.endpoint}
                </Code>
              </Box>

              <Box>
                <Text fontWeight="bold" mb={2} color="gray.400" fontSize="sm">
                  Timestamp:
                </Text>
                <Code p={3} borderRadius="md" display="block" bg="gray.700">
                  {new Date(errorDetails.timestamp).toLocaleString()}
                </Code>
              </Box>

              {errorDetails.stack && (
                <Box>
                  <Text fontWeight="bold" mb={2} color="gray.400" fontSize="sm">
                    Stack Trace:
                  </Text>
                  <Code
                    p={3}
                    borderRadius="md"
                    display="block"
                    whiteSpace="pre-wrap"
                    fontSize="xs"
                    bg="gray.700"
                    maxH="200px"
                    overflowY="auto"
                  >
                    {errorDetails.stack}
                  </Code>
                </Box>
              )}
            </VStack>
          )}
        </ModalBody>

        <ModalFooter>
          <Button colorScheme="blue" onClick={onClose}>
            Close
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
    </>
  );
};
