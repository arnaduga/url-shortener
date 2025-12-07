import { useState, useEffect, useCallback, useRef } from 'react';
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
  Radio,
  RadioGroup,
  Stack,
  FormHelperText,
  Spinner,
} from '@chakra-ui/react';
import { FiCopy, FiExternalLink, FiAlertCircle, FiChevronDown, FiChevronUp, FiSliders, FiCheck, FiX } from 'react-icons/fi';
import { useApi } from '../hooks/useApi';
import { API_ENDPOINT } from '../config';

// Custom ID validation messages and regex
// Allows: a-z (lowercase only), 0-9, -, _, .
// Does NOT allow: consecutive special characters (__, --, .., or combinations)
// Does NOT allow: uppercase letters
const CUSTOM_ID_REGEX = /^[a-z0-9]+([._-]?[a-z0-9]+)*$/;
// Regex for input validation (allows partial input while typing, including one trailing special char)
const CUSTOM_ID_INPUT_REGEX = /^[a-z0-9]+([._-]?[a-z0-9]+)*[._-]?$/;
const CUSTOM_ID_MESSAGES = {
  ALREADY_TAKEN: {
    title: 'Custom ID Already Taken',
    description: (id) => `"${id}" is already in use. Please choose a different ID.`,
  },
  AVAILABLE: {
    title: 'Custom ID Available',
    description: (id) => `"${id}" is available!`,
  },
  INVALID_LENGTH: {
    title: 'Invalid Custom ID',
    description: 'Custom ID must be between 4 and 80 characters',
  },
  INVALID_CHARACTERS: {
    title: 'Invalid Characters',
    description: 'Custom ID can only contain letters, numbers, and single hyphens (-), underscores (_), or periods (.) between alphanumeric characters',
  },
  REQUIRED: {
    title: 'Error',
    description: 'Please enter a custom ID',
  },
};

export const UrlShortenerForm = () => {
  const { apiCall } = useApi();
  const [longUrl, setLongUrl] = useState('');
  const [idType, setIdType] = useState('human_readable'); // 'random', 'human_readable', or 'custom'
  const [customId, setCustomId] = useState('');
  const [isCheckingAvailability, setIsCheckingAvailability] = useState(false);
  const [customIdAvailable, setCustomIdAvailable] = useState(null);
  const [ttl, setTtl] = useState(7);
  const [isLoading, setIsLoading] = useState(false);
  const [shortUrl, setShortUrl] = useState('');
  const [errorDetails, setErrorDetails] = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  const checkingRef = useRef(false);
  const toast = useToast();
  const { isOpen, onOpen, onClose } = useDisclosure();

  // URL validation using native URL API
  const isValidUrl = (url) => {
    try {
      const parsedUrl = new URL(url);
      // Only allow http and https protocols
      return parsedUrl.protocol === 'http:' || parsedUrl.protocol === 'https:';
    } catch (error) {
      return false;
    }
  };

  // Check custom ID availability (only called manually)
  const checkCustomIdAvailability = async () => {
    const id = customId.trim();

    if (!id || id.length < 4 || id.length > 80) {
      setCustomIdAvailable(null);
      return;
    }

    // Don't check if already checking
    if (checkingRef.current) {
      return;
    }

    checkingRef.current = true;
    setIsCheckingAvailability(true);

    try {
      // Check availability using HEAD method
      // Backend returns 200 if exists, 404 if not
      const apiUrl = API_ENDPOINT || window.location.origin;
      const url = `${apiUrl}/${id}`;

      console.log('Checking availability at:', url);

      const response = await fetch(url, {
        method: 'HEAD',
      });

      console.log('Check availability - Response status:', response.status);

      if (response.status === 200) {
        // ID exists - not available
        setCustomIdAvailable(false);
        toast({
          title: CUSTOM_ID_MESSAGES.ALREADY_TAKEN.title,
          description: CUSTOM_ID_MESSAGES.ALREADY_TAKEN.description(id),
          status: 'error',
          duration: 4000,
          isClosable: true,
        });
      } else if (response.status === 404) {
        // ID doesn't exist - available
        setCustomIdAvailable(true);
        toast({
          title: CUSTOM_ID_MESSAGES.AVAILABLE.title,
          description: CUSTOM_ID_MESSAGES.AVAILABLE.description(id),
          status: 'success',
          duration: 3000,
          isClosable: true,
        });
      } else {
        // Unknown status (including 403, 400, 500)
        console.warn('Unexpected status code:', response.status);
        setCustomIdAvailable(null);
        toast({
          title: 'Unable to Check',
          description: `Could not verify availability (status: ${response.status}). Please try creating the link directly.`,
          status: 'warning',
          duration: 4000,
          isClosable: true,
        });
      }
    } catch (error) {
      console.error('Error checking custom ID availability:', error);
      // On error, assume unavailable to be safe
      setCustomIdAvailable(null);
    } finally {
      checkingRef.current = false;
      setIsCheckingAvailability(false);
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

    // Validate custom ID if selected
    if (idType === 'custom') {
      if (!customId.trim()) {
        toast({
          title: CUSTOM_ID_MESSAGES.REQUIRED.title,
          description: CUSTOM_ID_MESSAGES.REQUIRED.description,
          status: 'error',
          duration: 3000,
          isClosable: true,
        });
        return;
      }

      if (!CUSTOM_ID_REGEX.test(customId)) {
        toast({
          title: CUSTOM_ID_MESSAGES.INVALID_CHARACTERS.title,
          description: CUSTOM_ID_MESSAGES.INVALID_CHARACTERS.description,
          status: 'error',
          duration: 4000,
          isClosable: true,
        });
        return;
      }

      if (customId.length < 4 || customId.length > 80) {
        toast({
          title: CUSTOM_ID_MESSAGES.INVALID_LENGTH.title,
          description: CUSTOM_ID_MESSAGES.INVALID_LENGTH.description,
          status: 'error',
          duration: 3000,
          isClosable: true,
        });
        return;
      }

      if (customIdAvailable === false) {
        toast({
          title: CUSTOM_ID_MESSAGES.ALREADY_TAKEN.title,
          description: CUSTOM_ID_MESSAGES.ALREADY_TAKEN.description(customId.trim()),
          status: 'error',
          duration: 3000,
          isClosable: true,
        });
        return;
      }
    }

    setIsLoading(true);
    setShortUrl('');

    try {
      const requestBody = {
        long_url: longUrl,
        ttl_in_days: ttl,
      };

      // Add the appropriate ID type parameter
      if (idType === 'custom') {
        requestBody.custom_id = customId;
      } else if (idType === 'human_readable') {
        requestBody.human_readable = true;
      }
      // For 'random', we don't send any additional parameter

      const response = await apiCall('/create', {
        method: 'POST',
        body: JSON.stringify(requestBody),
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
      setIdType('human_readable');
      setCustomId('');
      setCustomIdAvailable(null);
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
                <VStack spacing={6} align="stretch">
                  <FormControl>
                    <FormLabel mb={3}>Short ID Type</FormLabel>
                    <RadioGroup value={idType} onChange={setIdType}>
                      <Stack spacing={3}>
                        <Radio value="random" colorScheme="blue">
                          <VStack align="start" spacing={0}>
                            <Text>Random</Text>
                            <Text fontSize="xs" color="gray.400">Randomly generated ID (3-4 chars)</Text>
                          </VStack>
                        </Radio>
                        <Radio value="human_readable" colorScheme="blue">
                          <VStack align="start" spacing={0}>
                            <Text>Human Readable</Text>
                            <Text fontSize="xs" color="gray.400">Pronounceable syllable-based ID (3-4 chars)</Text>
                          </VStack>
                        </Radio>
                        <Box>
                          <Stack direction={{ base: 'column', md: 'row' }} align={{ base: 'stretch', md: 'start' }} spacing={4}>
                            <Radio value="custom" colorScheme="blue">
                              <VStack align="start" spacing={0}>
                                <Text>Custom ID</Text>
                                <Text fontSize="xs" color="gray.400">Choose your own ID (4-80 chars)</Text>
                              </VStack>
                            </Radio>
                            {idType === 'custom' && (
                              <Box flex="1" minW={{ base: 'auto', md: '200px' }} w={{ base: 'full', md: 'auto' }}>
                                <HStack spacing={2}>
                                  <InputGroup size="sm">
                                    <Input
                                      placeholder="my-custom-link"
                                      value={customId}
                                      onChange={(e) => {
                                        const value = e.target.value;
                                        // Only allow valid characters (less strict for input)
                                        if (value === '' || CUSTOM_ID_INPUT_REGEX.test(value)) {
                                          setCustomId(value);
                                          setCustomIdAvailable(null); // Reset availability when typing
                                        }
                                      }}
                                      bg="gray.600"
                                      border="none"
                                      _focus={{ bg: 'gray.600', ring: 2, ringColor: 'blue.500' }}
                                      pr="40px"
                                    />
                                    <InputRightElement>
                                      {isCheckingAvailability && <Spinner size="sm" color="blue.500" />}
                                      {!isCheckingAvailability && customIdAvailable === true && (
                                        <Tooltip label="Available">
                                          <Box as={FiCheck} color="green.400" />
                                        </Tooltip>
                                      )}
                                      {!isCheckingAvailability && customIdAvailable === false && (
                                        <Tooltip label="Already taken">
                                          <Box as={FiX} color="red.400" />
                                        </Tooltip>
                                      )}
                                    </InputRightElement>
                                  </InputGroup>
                                  <Button
                                    size="sm"
                                    onClick={checkCustomIdAvailability}
                                    isLoading={isCheckingAvailability}
                                    isDisabled={!customId || customId.trim().length < 4 || customId.length > 80}
                                    colorScheme="blue"
                                    variant="outline"
                                  >
                                    Check
                                  </Button>
                                </HStack>
                                {customId.length > 0 && (
                                  <Text fontSize="xs" color={customId.length < 4 || customId.length > 80 ? 'red.400' : 'gray.400'} mt={1}>
                                    {customId.length} / 80 characters (min: 4)
                                  </Text>
                                )}
                              </Box>
                            )}
                          </Stack>
                        </Box>
                      </Stack>
                    </RadioGroup>
                  </FormControl>

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
                </VStack>
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
