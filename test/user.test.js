//test file for user functionality
const userService = require("../service/userService");
const dao = require("../repository/userDAO");
const bcrypt = require("bcrypt");
const uuid = require("uuid")
jest.mock("../repository/userDAO");
jest.mock('bcrypt');
jest.mock('uuid');

describe("createUser", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test("Should create a user successfully", async () => {
        const mockUser = {
            username: "newuser1",
            password: "12345678",
            email: "user1@gmail.com"
        };

        dao.getUserByUsername.mockResolvedValue(null); // Username does not exist
        dao.getUserByEmail.mockResolvedValue(null); // Email does not exist
        bcrypt.hash.mockResolvedValue("hashedpassword"); // Mock hashed password
        uuid.v4.mockReturnValue("mocked-user-id"); // Mock UUID
        dao.createUser.mockResolvedValue({ userId: "mocked-user-id", ...mockUser });

        const result = await userService.createUser(mockUser);

        expect(result).toEqual({ userId: "mocked-user-id", ...mockUser });
    });

    test("Should throw an error if email is invalid", async () => {
        const invalidUser = { username: "newuser1", password: "12345678", email: "invalidemail" };

        await expect(userService.createUser(invalidUser)).rejects.toThrow("Email is not valid");
    });

    test("Should throw an error if username or password is too short", async () => {
        const shortUser = { username: "user1", password: "12345", email: "user1@gmail.com" };

        await expect(userService.createUser(shortUser)).rejects.toThrow(
            "Username and Password must be longer than 7 characters"
        );
    });

    test("Should throw an error if username already exists", async () => {
        dao.getUserByUsername.mockResolvedValue({ username: "existinguser" });

        const existingUser = { username: "existinguser", password: "12345678", email: "user1@gmail.com" };

        await expect(userService.createUser(existingUser)).rejects.toThrow("Username already exists");
    });

    test("Should throw an error if email already exists", async () => {
        dao.getUserByUsername.mockResolvedValue(null);
        dao.getUserByEmail.mockResolvedValue({ email: "user1@gmail.com" });

        const existingEmailUser = { username: "newuser1", password: "12345678", email: "user1@gmail.com" };

        await expect(userService.createUser(existingEmailUser)).rejects.toThrow("Email already exists");
    });
});

describe("updateUserProfile", () => {
    beforeEach(() => {
        jest.clearAllMocks(); // Reset mocks before each test
    });

    test("Should update user profile successfully with new image", async () => {
        const mockUser = { userId: "12345" };
        const mockOldProfile = {
            biography: "Old bio",
            preferredGenres: ["Action"],
            profilePicture: "profile/old-image.jpg"
        };
        const mockUserData = {
            biography: "New bio",
            preferredGenres: ["Comedy", "Drama"]
        };
        const mockFile = { originalname: "new-image.jpg" };

        const mockFileName = `profile/new-uuid-new-image.jpg`;
        const mockSignedUrl = "https://signed-url.com/new-image.jpg";

        uuid.v4.mockReturnValue("new-uuid");
        dao.getUserByUserId.mockResolvedValue(mockOldProfile);
        dao.generateSignedUrl.mockResolvedValue(mockSignedUrl);
        dao.updateProfile.mockResolvedValue({
            ...mockOldProfile,
            biography: mockUserData.biography,
            preferredGenres: mockUserData.preferredGenres,
            profilePicture: mockFileName
        });

        const result = await userService.updateUserProfile(mockUser, mockUserData, mockFile);

        expect(result).toEqual({
            message: "Profile updated successfully",
            user: {
                biography: "New bio",
                preferredGenres: ["Comedy", "Drama"],
                profilePicture: mockFileName
            },
            signedUrl: mockSignedUrl
        });
    });

    test("Should update profile without changing the image if no new file is uploaded", async () => {
        const mockUser = { userId: "12345" };
        const mockOldProfile = {
            biography: "Old bio",
            preferredGenres: ["Action"],
            profilePicture: "profile/existing-image.jpg"
        };
        const mockUserData = {
            biography: "New bio",
            preferredGenres: ["Drama"]
        };
        const mockSignedUrl = "https://signed-url.com/old-image.jpg";

        dao.getUserByUserId.mockResolvedValue(mockOldProfile);
        dao.generateSignedUrl.mockResolvedValue(mockSignedUrl);
        dao.updateProfile.mockResolvedValue({
            ...mockOldProfile,
            biography: "New bio",
            preferredGenres: ["Drama"]
        });

        const result = await userService.updateUserProfile(mockUser, mockUserData, null);

        expect(dao.deleteS3File).not.toHaveBeenCalled(); // No file uploaded, so no deletion
        expect(dao.uploadFileToS3).not.toHaveBeenCalled(); // No new file        

        expect(result).toEqual({
            message: "Profile updated successfully",
            user: {
                biography: "New bio",
                preferredGenres: ["Drama"],
                profilePicture: "profile/existing-image.jpg"
            },
            signedUrl: mockSignedUrl
        });
    });

    test("Should throw error if user is not found", async () => {
        dao.getUserByUserId.mockResolvedValue(null);

        await expect(userService.updateUserProfile({ userId: "12345" }, {}, null)).rejects.toThrow(
            "User could not be found"
        );

    });

    test("Should handle S3 upload error", async () => {
        const mockUser = { userId: "12345" };
        const mockOldProfile = { profilePicture: "profile/old-image.jpg" };
        const mockFile = { originalname: "new-image.jpg" };

        dao.getUserByUserId.mockResolvedValue(mockOldProfile);
        dao.uploadFileToS3.mockRejectedValue(new Error("S3 upload failed"));

        await expect(userService.updateUserProfile(mockUser, {}, mockFile)).rejects.toThrow("S3 upload failed");

        expect(dao.uploadFileToS3).toHaveBeenCalled();
    });
});

describe("Change password", () => {
    const mockUser = { userId: '123', username: 'testUser'};

    beforeEach(() => jest.clearAllMocks());

    it('Throws if user is not found', async () => {
        dao.getUserByUserId.mockResolvedValue(null);

        await expect(
            userService.changePassword({ password: 'abc12345'}, mockUser)
        ).rejects.toThrow('User could not be found');
    });

    it("Throws if password is too short", async () => {
        dao.getUserByUserId.mockResolvedValue(mockUser);

        await expect(
            userService.changePassword({ password: 'short'}, mockUser)
        ).rejects.toThrow('Password must be longer than 7 characters');
    });

    it("Hashes password and calls DAO", async () => {
        dao.getUserByUserId.mockResolvedValue(mockUser);

        bcrypt.hash.mockResolvedValue('hashed-pass');
        dao.changePassword.mockResolvedValue();

        await userService.changePassword({ password: 'abc12345'}, mockUser);

        expect(bcrypt.hash).toHaveBeenCalledWith('abc12345', 10);
        expect(dao.changePassword).toHaveBeenCalledWith(mockUser.userId, 'hashed-pass');
    });
});

describe("Delete User", () => {
    const mockUserId = '123';
    const mockToken = { userId: mockUserId};

    beforeEach(() => jest.clearAllMocks());

    it("Throws if user is not found", async () => {
        dao.getUserByUserId.mockResolvedValue(null);

        await expect(
            userService.deleteUser(mockToken)
        ).rejects.toThrow('User could not be found');

        expect(dao.getUserByUserId).toHaveBeenCalledWith(mockUserId);
        expect(dao.deleteUser).not.toHaveBeenCalled();
    });

    it("Throws if user is not found", async () => {
        dao.getUserByUserId.mockResolvedValue({ userId: mockUserId });
        dao.deleteUser.mockRejectedValue(new Error ("DAO: failed to delete user"))

        await expect(
            userService.deleteUser(mockToken)
        ).rejects.toThrow('DAO: failed to delete user');

        expect(dao.getUserByUserId).toHaveBeenCalledWith(mockUserId);
        expect(dao.deleteUser).toHaveBeenCalledWith(mockUserId);
    });

    it("Deletes a user successfully", async () => {
        dao.getUserByUserId.mockResolvedValue({ userId: mockUserId });
        dao.deleteUser.mockResolvedValue({});

        await expect(
            userService.deleteUser(mockToken)
        ).resolves.not.toThrow();

        expect(dao.getUserByUserId).toHaveBeenCalledWith(mockUserId);
        expect(dao.deleteUser).toHaveBeenCalledWith(mockUserId);
    });
});

describe("Friend Requests", () => {
    let mockUsername1 = 'testUser1';
    let mockUsername2 = 'testUser2';
    let mockUserId1 = '123';
    let mockUserId2 = '546';

    beforeEach(() => jest.clearAllMocks());

    it("Throws if friend is not found by username", async () => {
        dao.getUserByUsername.mockResolvedValue(null);
        dao.getUserByUserId.mockResolvedValue(null);

        await expect(userService.addFriend(mockUsername1, mockUserId1)).rejects.toThrow('Friend username could not be found')
        expect(dao.getUserByUsername).toHaveBeenCalledWith(mockUsername1);
    })

    it("Throws user is not found by userId", async () => {
        dao.getUserByUsername.mockResolvedValue({userId: mockUserId2});
        dao.getUserByUserId.mockResolvedValue(null);

        await expect(userService.addFriend(mockUsername1, mockUserId1)).rejects.toThrow('User could not be found')
        expect(dao.getUserByUsername).toHaveBeenCalledWith(mockUsername1);
        expect(dao.getUserByUserId).toHaveBeenCalledWith(mockUserId1);
    })

    it("Throws if users are already friends", async () => {
        dao.getUserByUsername.mockResolvedValue({userId: mockUserId2, username: mockUsername2, friends: [{userId: mockUserId1, username: mockUsername1}]});
        dao.getUserByUserId.mockResolvedValue({userId: mockUserId1, username: mockUsername1, friends: [{userId: mockUserId2, username: mockUsername2}]});

        await expect(userService.addFriend(mockUsername1, mockUserId1)).rejects.toThrow('User already friends')
        expect(dao.getUserByUsername).toHaveBeenCalledWith(mockUsername1);
        expect(dao.getUserByUserId).toHaveBeenCalledWith(mockUserId1);
    });

    it("Successfully adds a friend", async () => {
        dao.getUserByUsername.mockResolvedValue({userId: mockUserId2, username: mockUsername2, friends: []});
        dao.getUserByUserId.mockResolvedValue({userId: mockUserId1, username: mockUsername1, friends: []});
        dao.addFriend.mockResolvedValue({});

        await expect(userService.addFriend(mockUsername1, mockUserId1)).resolves.not.toThrow()

        expect(dao.getUserByUsername).toHaveBeenCalledWith(mockUsername1);
        expect(dao.getUserByUserId).toHaveBeenCalledWith(mockUserId1);
    })
});

describe("Ban User", () => {
    let mockUserId = '123';
    let mockStatusBanned = 'banned'
    let mockStatusUnbanned = 'unbanned'

    beforeEach(() => jest.clearAllMocks());

    it("Throws if user is not found", async () => {
        dao.getUserByUserId.mockResolvedValue(null);

        await expect(userService.banUser(mockUserId, mockStatusBanned)).rejects.toThrow('User could not be found')
        expect(dao.getUserByUserId).toHaveBeenCalledWith(mockUserId);
    })

    it("Does not ban users when invalid ban status", async () => {
        dao.getUserByUserId.mockResolvedValue(mockUserId);
        dao.banUser.mockResolvedValue({});

        await expect(userService.banUser(mockUserId, 'invalid status')).resolves.not.toThrow();

        expect(dao.getUserByUserId).toHaveBeenCalledWith(mockUserId);
        expect(dao.banUser).not.toHaveBeenCalled();
    })

    it("Bans users when using banned status", async () => {
        dao.getUserByUserId.mockResolvedValue(mockUserId);
        dao.banUser.mockResolvedValue({});

        await expect(userService.banUser(mockUserId, mockStatusBanned)).resolves.not.toThrow();

        expect(dao.getUserByUserId).toHaveBeenCalledWith(mockUserId);
        expect(dao.banUser).toHaveBeenCalledWith(mockUserId, true);
    })

    it("Bans users when using unbanned status", async () => {
        dao.getUserByUserId.mockResolvedValue(mockUserId);
        dao.banUser.mockResolvedValue({});

        await expect(userService.banUser(mockUserId, mockStatusUnbanned)).resolves.not.toThrow();

        expect(dao.getUserByUserId).toHaveBeenCalledWith(mockUserId);
        expect(dao.banUser).toHaveBeenCalledWith(mockUserId, false);
    })
})


describe("validateLogin", () => {

    // Test for missing username or password
    it("should return null if username or password is missing", async () => {
      let response = await userService.validateLogin("testuser", "");
      expect(response).toBeNull();
  
      response = await userService.validateLogin("", "password");
      expect(response).toBeNull();
  
      response = await userService.validateLogin("", "");
      expect(response).toBeNull();
    });
  
    // Test for user not found in the database
    it("should return null if user is not found", async () => {
      dao.getUserByUsername.mockResolvedValue(null);
  
      const response = await userService.validateLogin("nonexistentuser", "password");
      expect(response).toBeNull();
      expect(dao.getUserByUsername).toHaveBeenCalledWith("nonexistentuser");
    });
  
    // Test for password mismatch
    it("should return null if password does not match", async () => {
      const mockUser = {
        username: "testuser",
        password: "$2b$10$hashedpassword" // Just an example hash
      };
  
      dao.getUserByUsername.mockResolvedValue(mockUser);
      bcrypt.compare.mockResolvedValue(false); // Password mismatch
  
      const response = await userService.validateLogin("testuser", "wrongpassword");
      expect(response).toBeNull();
      expect(bcrypt.compare).toHaveBeenCalledWith("wrongpassword", mockUser.password);
    });
  
    // Test for successful login
    it("should return user data without password if login is successful", async () => {
      const mockUser = {
        userId: 1,
        username: "testuser",
        password: "$2b$10$hashedpassword", // Just an example hash
        isAdmin: false,
        isBanned: false
      };

      const omitted = {
        userId: 1,
        username: "testuser",
        
        isAdmin: false,
        isBanned: false
      }
  
      dao.getUserByUsername.mockResolvedValue(mockUser);
      bcrypt.compare.mockResolvedValue(true); // Password matches
  
      const response = await userService.validateLogin("testuser", "correctpassword");
      expect(response).not.toBeNull();
      expect(response.username).toBe(mockUser.username);
      expect(response.password).toBeUndefined(); // Password should be omitted
      expect(omitted).toEqual(omitted);
      expect(bcrypt.compare).toHaveBeenCalledWith("correctpassword", mockUser.password);
    });
});



describe("getFriendsList", () => {

    // Test for missing or invalid userId
    it("should throw an error if userId is not provided", async () => {
      await expect(userService.getFriendsList()).rejects.toThrow("need a valid userId");
      await expect(userService.getFriendsList(null)).rejects.toThrow("need a valid userId");
      await expect(userService.getFriendsList(undefined)).rejects.toThrow("need a valid userId");
    });
  
    // Test for failed retrieval of friends list (userDao returns null)
    it("should throw an error if friends list is not retrieved", async () => {
      dao.getFriendsListByUserId.mockResolvedValue(null);
  
      await expect(userService.getFriendsList(1)).rejects.toThrow("friendslist not retrieved");
    });
  
    // Test for empty friends list
    it("should return an empty array if friends list is empty", async () => {
      dao.getFriendsListByUserId.mockResolvedValue([]);
  
      const response = await userService.getFriendsList(1);
      expect(response).toEqual([]);
    });
  
    // Test for valid friends list retrieval and transformation
    it("should return a formatted friends list when the data is valid", async () => {
      const mockFriendsList = [
        {
          userId: 1,
          username: "friend1",
          profilePicture: "url1",
          biography: "bio1",
          preferredGenres: ["rock"]
        },
        {
          userId: 2,
          username: "friend2",
          profilePicture: "url2",
          biography: "bio2",
          preferredGenres: ["pop"]
        }
      ];
  
      dao.getFriendsListByUserId.mockResolvedValue(mockFriendsList);
  
      const expectedResponse = [
        {
          userId: 1,
          username: "friend1",
          profilePicture: "url1",
          biography: "bio1",
          preferredGenres: ["rock"]
        },
        {
          userId: 2,
          username: "friend2",
          profilePicture: "url2",
          biography: "bio2",
          preferredGenres: ["pop"]
        }
      ];
  
      const response = await userService.getFriendsList(1);
      expect(response).toEqual(expectedResponse);
    });
  
    // Test for any errors thrown during execution (generic error handling)
    it("should propagate errors correctly", async () => {
      dao.getFriendsListByUserId.mockRejectedValue(new Error("Database error"));
  
      await expect(userService.getFriendsList(1)).rejects.toThrow("Database error");
    });
});