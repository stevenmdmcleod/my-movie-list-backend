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