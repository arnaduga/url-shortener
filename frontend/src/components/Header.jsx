import {
  Box,
  Flex,
  HStack,
  Avatar,
  Text,
  Button,
  Menu,
  MenuButton,
  MenuList,
  MenuItem,
  VStack,
  useBreakpointValue,
  useDisclosure,
  AlertDialog,
  AlertDialogBody,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogContent,
  AlertDialogOverlay,
} from '@chakra-ui/react';
import { FiChevronDown } from 'react-icons/fi';
import { useRef } from 'react';

export const Header = ({ user, onSignOut }) => {
  const isMobile = useBreakpointValue({ base: true, md: false });
  const { isOpen, onOpen, onClose } = useDisclosure();
  const cancelRef = useRef();

  const handleSignOut = () => {
    onClose();
    onSignOut();
  };

  return (
    <>
    <Box
      bg="rgba(26, 32, 44, 0.8)"
      backdropFilter="blur(10px)"
      px={4}
      py={3}
      borderBottom="1px"
      borderColor="whiteAlpha.200"
      position="relative"
      zIndex={10}
    >
      <Flex justify="space-between" align="center" maxW="1200px" mx="auto">
        <Text fontSize="2xl" fontWeight="bold" bgGradient="linear(to-r, blue.400, purple.500)" bgClip="text">
          URL Shortener
        </Text>

        {user && (
          <Menu>
            <MenuButton
              as={Button}
              rightIcon={!isMobile && <FiChevronDown />}
              variant="ghost"
              _hover={{ bg: 'gray.700' }}
            >
              <HStack spacing={isMobile ? 0 : 3}>
                <Avatar size="sm" name={user.name} src={user.picture} />
                {!isMobile && (
                  <VStack align="start" spacing={0}>
                    <Text fontSize="sm" fontWeight="medium">
                      {user.name}
                    </Text>
                    <Text fontSize="xs" color="gray.400">
                      {user.email}
                    </Text>
                  </VStack>
                )}
              </HStack>
            </MenuButton>
            <MenuList bg="gray.800" borderColor="gray.700">
              <MenuItem bg="gray.800" _hover={{ bg: 'gray.700' }} onClick={onOpen}>
                Sign Out
              </MenuItem>
            </MenuList>
          </Menu>
        )}
      </Flex>
    </Box>

    <AlertDialog
      isOpen={isOpen}
      leastDestructiveRef={cancelRef}
      onClose={onClose}
      isCentered
    >
      <AlertDialogOverlay backdropFilter="blur(4px)">
        <AlertDialogContent bg="gray.800" borderColor="gray.700" borderWidth="1px">
          <AlertDialogHeader fontSize="lg" fontWeight="bold">
            Sign Out
          </AlertDialogHeader>

          <AlertDialogBody>
            Are you sure you want to sign out? Your session will be ended.
          </AlertDialogBody>

          <AlertDialogFooter>
            <Button ref={cancelRef} onClick={onClose} variant="ghost">
              Cancel
            </Button>
            <Button colorScheme="red" onClick={handleSignOut} ml={3}>
              Sign Out
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialogOverlay>
    </AlertDialog>
    </>
  );
};
