const watchlistService = require("../service/watchlistService");
const watchlistDao = require("../repository/watchlistDAO");
const userDao = require("../repository/userDAO");
const uuid = require('uuid');
const logger = require('../util/logger');
const { marshall } = require('@aws-sdk/util-dynamodb');

jest.mock("../repository/watchlistDAO");
jest.mock("../repository/userDAO");
jest.mock('../util/logger');
jest.mock('uuid');


describe("updateWatchlist", () => {

    beforeEach(() => {
        jest.clearAllMocks();
    });

    test("should update the watchlist successfully", async () => {
        const userId = "user123";
        const listId = "list123";
        const data = { listName: "Updated List", isPublic: true };

        watchlistDao.getWatchlistByListId.mockResolvedValue({ userId }); //mock the userId in the existing list
        watchlistDao.updateWatchlist.mockResolvedValue({ listId, ...data });

        const result = await watchlistService.updateWatchlist(userId, listId, data);

        expect(result).toEqual({
            message: "Watchlist updated successfully",
            watchlist: { listId, ...data },
        });
    });

    test("should not throw an error if the watchlist with the same name is the one being updated", async () => {
        const userId = "user123";
        const listId = "list123";
        const listName = "my list";
        watchlistDao.getWatchlistByUserIdAndListName.mockResolvedValue([{ listId, listName }]);

        watchlistDao.getWatchlistByListId.mockResolvedValue({ userId, listId, listName });
        watchlistDao.updateWatchlist.mockResolvedValue({ listId, listName, isPublic: true });

        const result = await watchlistService.updateWatchlist(userId, listId, { listName, isPublic: true });

        expect(result).toHaveProperty("message", "Watchlist updated successfully");
    });

    test("should throw an error if list name is empty", async () => {
        await expect(watchlistService.updateWatchlist("user123", "list123", { listName: " ", isPublic: true }))
            .rejects.toThrow("List name cannot be empty.");
    });

    test("should throw an error if user is not authorized", async () => {
        watchlistDao.getWatchlistByListId.mockResolvedValue({ userId: "anotherUser" });

        await expect(watchlistService.updateWatchlist("user123", "list123", { listName: "Updated", isPublic: true }))
            .rejects.toThrow("Unauthorized: You can only update your own watchlist.");
    });

    test("should throw an error if watchlist is not found", async () => {
        watchlistDao.getWatchlistByListId.mockResolvedValue(null);

        await expect(watchlistService.updateWatchlist("user123", "list123", { listName: "Updated", isPublic: true }))
            .rejects.toThrow("WatchList not found");
    });

    test("should throw an error if the name already exists", async () => {
        watchlistDao.getWatchlistByUserIdAndListName.mockResolvedValue([{listId: "list123", listName: "Updated"}])
        watchlistDao.getWatchlistByListId.mockResolvedValue({listId: "list345", userId: "user123"})
        await expect(watchlistService.updateWatchlist("user123", "list345", { listName: "Updated", isPublic: true }))
            .rejects.toThrow("A watchlist with that name already exists!");
    });
});

describe("commentOnWatchList", () => {
    const userId = "user-123";
    const username = "user123";
    const anotherUserId = "user-456";
    const listId = "list-456";
    const comment = "This is a test comment";

    beforeEach(() => {
        jest.clearAllMocks();
    });

    test("should add a comment successfully to a public watchlist", async () => {

        const existingWatchList = {
            listId,
            isPublic: true,
            userId: anotherUserId,
            collaborators: [],
            comments: []
        };

        const mockComment = {
            commentId: "mock-comment-id-123",
            userId: userId,
            username: username,
            comment: comment,
            datePosted: new Date().toISOString()
        };
        uuid.v4.mockReturnValue("mock-comment-id-123");
        watchlistDao.getWatchlistByListId.mockResolvedValue(existingWatchList);
        watchlistDao.updateWatchlist.mockResolvedValue({ ...existingWatchList, comments: [mockComment] });

        const result = await watchlistService.commentOnWatchList({ userId, username, listId, comment });

        expect(result.message).toBe("Comment added successfully");
        expect(result.comment.commentId).toBeDefined();
        expect(result.comment.comment).toBe(comment);
    });

    test("should add a comment successfully if the user is the owner of a private list", async () => {

        const existingWatchList = { listId, isPublic: false, userId, collaborators: [], comments: [] };

        const mockComment = {
            commentId: "mock-comment-id-123",
            userId: userId,
            username: username,
            comment: comment,
            datePosted: new Date().toISOString()
        };

        watchlistDao.getWatchlistByListId.mockResolvedValue(existingWatchList);
        watchlistDao.updateWatchlist.mockResolvedValue({ ...existingWatchList, comments: [mockComment] });

        const result = await watchlistService.commentOnWatchList({ userId, username, listId, comment });

        expect(result).toHaveProperty("message", "Comment added successfully");
    });

    test("should add a comment successfully if the user is a collaborator on a private list", async () => {
       
        const existingWatchList = { listId, isPublic: false, userId: anotherUserId, collaborators: [userId], comments: [] };

        const mockComment = {
            commentId: "mock-comment-id-123",
            userId: userId,
            username: username,
            comment: comment,
            datePosted: new Date().toISOString()
        };

        watchlistDao.getWatchlistByListId.mockResolvedValue(existingWatchList);
        watchlistDao.updateWatchlist.mockResolvedValue({ ...existingWatchList, comments: [mockComment] });

        const result = await watchlistService.commentOnWatchList({ userId, username, listId, comment });

        expect(result).toHaveProperty("message", "Comment added successfully");
    });

    test("should throw an error if the user is not allowed to comment on a private list", async () => {

        const existingWatchList = { listId, isPublic: false, userId: anotherUserId, collaborators: []};

        watchlistDao.getWatchlistByListId.mockResolvedValue(existingWatchList);

        await expect(watchlistService.commentOnWatchList({ userId, username, listId, comment }))
            .rejects.toThrow("Unauthorized: You cannot comment on this watchlist.");
    });

    test("should throw an error if the watchlist does not exist", async () => {
        watchlistDao.getWatchlistByListId.mockResolvedValue(null);

        await expect(watchlistService.commentOnWatchList({ userId, username, listId, comment }))
            .rejects.toThrow("WatchList not found");
    });

    test("should throw an error if the comment is empty", async () => {
        await expect(watchlistService.commentOnWatchList({ userId, username, listId, comment:"" }))
            .rejects.toThrow("Comment cannot be empty.");
    });
});

describe("deleteCommentOnWatchList", () => {
    const listId = "list-123";
    const commentId = "comment-456";

    beforeEach(() => {
        jest.clearAllMocks();
    });

    test("should delete a comment successfully", async () => {
        const existingWatchList = {
            listId,
            comments: [
                { commentId: "comment-123", comment: "First comment" },
                { commentId, comment: "Second comment" }
            ]
        };

        watchlistDao.getWatchlistByListId.mockResolvedValue(existingWatchList);
        watchlistDao.updateWatchlist.mockResolvedValue({
            ...existingWatchList,
            comments: [{ commentId: "comment-123", comment: "First comment" }]
        });

        const result = await watchlistService.deleteCommentOnWatchList(listId, commentId);

        expect(result.message).toBe("Comment deleted successfully");
        expect(result.watchlist.comments.length).toBe(1);
    });

    test("should throw an error if Comment is not found", async () => {
        const existingWatchList = {
            listId,
            comments: []
        };

        watchlistDao.getWatchlistByListId.mockResolvedValue(existingWatchList);

        await expect(watchlistService.deleteCommentOnWatchList(listId, commentId))
            .rejects.toThrow("Comment not found");
        
    });

    test("should throw an error if watchlist is not found", async () => {
        watchlistDao.getWatchlistByListId.mockResolvedValue(null);

        await expect(watchlistService.deleteCommentOnWatchList(listId, commentId))
            .rejects.toThrow("WatchList not found");
    });

});

describe("Like Watchlist", () => {
    let mockUserId = '123';
    let mockListId = '456';

    beforeEach(() => jest.clearAllMocks());

    it("Throws if user cannot be found", async () => {
        userDao.getUserByUserId.mockResolvedValue(null);
        watchlistDao.getWatchlistByListId(null);

        await expect(watchlistService.likeWatchlist(mockUserId, mockListId)).rejects.toThrow("User could not be found");

        expect(userDao.getUserByUserId).toHaveBeenCalledWith(mockUserId);
    })

    it("Throws if watchlist cannot be found", async () => {
        userDao.getUserByUserId.mockResolvedValue({userId: mockUserId, likedLists: []});
        watchlistDao.getWatchlistByListId.mockResolvedValue(null);

        await expect(watchlistService.likeWatchlist(mockUserId, mockListId)).rejects.toThrow("Watchlist could not be found");

        expect(userDao.getUserByUserId).toHaveBeenCalledWith(mockUserId);
        expect(watchlistDao.getWatchlistByListId).toHaveBeenCalledWith(mockListId);
    })

    it("Likes watchlist successfully", async () => {
        userDao.getUserByUserId.mockResolvedValue({userId: mockUserId, likedLists: []});
        watchlistDao.getWatchlistByListId.mockResolvedValue({listId: mockListId, likes:[]});

        await expect(watchlistService.likeWatchlist(mockUserId, mockListId)).resolves.not.toThrow();

        expect(userDao.getUserByUserId).toHaveBeenCalledWith(mockUserId);
        expect(watchlistDao.getWatchlistByListId).toHaveBeenCalledWith(mockListId);
    })

    it("Unlikes already liked watchlist successfully", async () => {
        userDao.getUserByUserId.mockResolvedValue({userId: mockUserId, likedLists: [mockListId]});
        watchlistDao.getWatchlistByListId.mockResolvedValue({listId: mockListId, likes:[mockUserId]});

        await expect(watchlistService.likeWatchlist(mockUserId, mockListId)).resolves.not.toThrow();

        expect(userDao.getUserByUserId).toHaveBeenCalledWith(mockUserId);
        expect(watchlistDao.getWatchlistByListId).toHaveBeenCalledWith(mockListId);
    })
})

describe("Add Collaborator", () => {
    let mockUserId = '123';
    let mockCollaboratorId = '456';
    let mockListId = '789';

    beforeEach(() => jest.clearAllMocks());

    it("Throws if watchlist doesn't exist", async () => {
        userDao.getUserByUserId.mockResolvedValue(null);
        watchlistDao.getWatchlistByListId.mockResolvedValue(null);

        await expect(watchlistService.addCollaborators(mockUserId, mockListId, mockCollaboratorId)).rejects.toThrow("Watchlist doesn't exist!")
        
        expect(watchlistDao.getWatchlistByListId).toHaveBeenCalledWith(mockListId);
    })
    
    // userDao.getUserByUserId.mockResolvedValueOnce({userId: mockUserId, collaborativeLists:[]}).mockResolvedValueOnce({userId: mockCollaboratorId, collaborativeLists:[]})
    it("Throws if user doesn't exist", async () => {
        userDao.getUserByUserId.mockResolvedValue(null);
        watchlistDao.getWatchlistByListId.mockResolvedValue({listId: mockListId, collaborators: []});

        await expect(watchlistService.addCollaborators(mockUserId, mockListId, mockCollaboratorId)).rejects.toThrow("User could not be found")
        
        expect(userDao.getUserByUserId).toHaveBeenCalledWith(mockUserId);
        expect(watchlistDao.getWatchlistByListId).toHaveBeenCalledWith(mockListId);
    })

    it("Throws if user doesn't exist", async () => {
        userDao.getUserByUserId
            .mockResolvedValueOnce({userId: mockUserId, collaborativeLists:[]})
            .mockResolvedValueOnce(null)
        watchlistDao.getWatchlistByListId
            .mockResolvedValue({listId: mockListId, collaborators: []});

        await expect(watchlistService.addCollaborators(mockUserId, mockListId, mockCollaboratorId)).rejects.toThrow("User could not be found from collaborator ID")
        
        expect(userDao.getUserByUserId).toHaveBeenCalledWith(mockUserId);
        expect(watchlistDao.getWatchlistByListId).toHaveBeenCalledWith(mockListId);
    })

    it("Throws if watchlist owner isn't making the request", async () => {
        userDao.getUserByUserId
            .mockResolvedValueOnce({userId: mockUserId, collaborativeLists:[]})
            .mockResolvedValueOnce({userId: mockCollaboratorId, collaborativeLists:[]})
        watchlistDao.getWatchlistByListId
            .mockResolvedValue({listId: mockListId, userId: '111', collaborators: []});

        await expect(watchlistService.addCollaborators(mockUserId, mockListId, mockCollaboratorId)).rejects.toThrow("User must be owner of the watchlist to add a collaborator")
        
        expect(userDao.getUserByUserId).toHaveBeenCalledWith(mockUserId);
        expect(watchlistDao.getWatchlistByListId).toHaveBeenCalledWith(mockListId);
    })

    it("Throws if watchlist owner tries to add themselves as a collaborator", async () => {
        userDao.getUserByUserId
            .mockResolvedValueOnce({userId: mockUserId, collaborativeLists:[]})
            .mockResolvedValueOnce({userId: mockUserId, collaborativeLists:[]})
        watchlistDao.getWatchlistByListId
            .mockResolvedValue({listId: mockListId, userId: mockUserId, collaborators: []});

        await expect(watchlistService.addCollaborators(mockUserId, mockListId, mockCollaboratorId)).rejects.toThrow("Watchlist creator is already an implied collaborator, cannot add to list")
        
        expect(userDao.getUserByUserId).toHaveBeenCalledWith(mockUserId);
        expect(watchlistDao.getWatchlistByListId).toHaveBeenCalledWith(mockListId);
    })

    it("Throws if collaborator is not friends with owner", async () => {
        userDao.getUserByUserId
            .mockResolvedValueOnce({userId: mockUserId, collaborativeLists:[], friends:[]})
            .mockResolvedValueOnce({userId: mockCollaboratorId, collaborativeLists:[], friends:[]})
        watchlistDao.getWatchlistByListId
            .mockResolvedValue({listId: mockListId, userId: mockUserId, collaborators: []});

        await expect(watchlistService.addCollaborators(mockUserId, mockListId, mockCollaboratorId)).rejects.toThrow("User must be a friend to become a collaborator")
        
        expect(userDao.getUserByUserId).toHaveBeenCalledWith(mockUserId);
        expect(watchlistDao.getWatchlistByListId).toHaveBeenCalledWith(mockListId);
    })

    it("Throws if collaborator is already on list", async () => {
        userDao.getUserByUserId
            .mockResolvedValueOnce({userId: mockUserId, collaborativeLists:[], friends:[{userId:mockCollaboratorId, username: 'testUser2'}]})
            .mockResolvedValueOnce({userId: mockCollaboratorId, collaborativeLists:[mockListId], friends:[{userId: mockUserId, username: 'testUser1'}]})
        watchlistDao.getWatchlistByListId
            .mockResolvedValue({listId: mockListId, userId: mockUserId, collaborators: [mockCollaboratorId]});

        await expect(watchlistService.addCollaborators(mockUserId, mockListId, mockCollaboratorId)).rejects.toThrow("User is already a collaborator")
        
        expect(userDao.getUserByUserId).toHaveBeenCalledWith(mockUserId);
        expect(watchlistDao.getWatchlistByListId).toHaveBeenCalledWith(mockListId);
    })

    it("Adds collaborators successfully", async () => {
        userDao.getUserByUserId
            .mockResolvedValueOnce({userId: mockUserId, collaborativeLists:[], friends:[{userId:mockCollaboratorId, username: 'testUser2'}]})
            .mockResolvedValueOnce({userId: mockCollaboratorId, collaborativeLists:[], friends:[{userId: mockUserId, username: 'testUser1'}]})
        watchlistDao.getWatchlistByListId
            .mockResolvedValue({listId: mockListId, userId: mockUserId, collaborators: []});
        watchlistDao.updateWatchlist.mockResolvedValue({});
        userDao.updateUser.mockResolvedValue({});

        await expect(watchlistService.addCollaborators(mockUserId, mockListId, mockCollaboratorId)).resolves.not.toThrow();
        
        expect(userDao.getUserByUserId).toHaveBeenCalledWith(mockUserId);
        expect(watchlistDao.getWatchlistByListId).toHaveBeenCalledWith(mockListId);
    })
})


describe("addOrRemoveTitle", () => {
    const userId = "user-123";
    const listId = "list-456";
    const titleId = "title-789";

    beforeEach(() => {
        jest.clearAllMocks();
    });

    test("should add a title successfully if user is the owner", async () => {
        const watchlist = {
            listId,
            userId,
            collaborators: [],
            titles: []
        };
        const user = { userId, recentlyAdded: [] };

        watchlistDao.getWatchlistByListId.mockResolvedValue(watchlist);
        userDao.getUserByUserId.mockResolvedValue(user);
        watchlistDao.updateWatchlist.mockResolvedValue();    
        userDao.updateUser.mockResolvedValue();

        const result = await watchlistService.addOrRemoveTitle(userId, listId, titleId);

        expect(result).toBe("added");
        expect(watchlistDao.updateWatchlist).toHaveBeenCalledWith(listId, { titles: [titleId] });
        expect(userDao.updateUser).toHaveBeenCalledWith(userId, { recentlyAdded: [titleId] });
    });

    test("should add a title successfully if user is a collaborator", async () => {
        const anotherUserId = "user-456";
        const watchlist = {
            listId,
            userId,
            collaborators: [anotherUserId],
            titles: []
        };
        const user = { userId: anotherUserId, recentlyAdded: [] };

        watchlistDao.getWatchlistByListId.mockResolvedValue(watchlist);
        userDao.getUserByUserId.mockResolvedValue(user);
        watchlistDao.updateWatchlist.mockResolvedValue();    
        userDao.updateUser.mockResolvedValue();

        const result = await watchlistService.addOrRemoveTitle(anotherUserId, listId, titleId);

        expect(result).toBe("added");
        expect(userDao.updateUser).toHaveBeenCalled();
    });

    test("should remove a title successfully", async () => {
        const watchlist = {
            listId,
            userId,
            collaborators: [],
            titles: [titleId]
        };
        const user = { userId, recentlyAdded: [titleId] };

        watchlistDao.getWatchlistByListId.mockResolvedValue(watchlist);
        userDao.getUserByUserId.mockResolvedValue(user);
        watchlistDao.updateWatchlist.mockResolvedValue();
        userDao.updateUser.mockResolvedValue();

        const result = await watchlistService.addOrRemoveTitle(userId, listId, titleId);

        expect(result).toBe("removed");
        expect(userDao.updateUser).not.toHaveBeenCalled(); // No need to update user
    });

    test("should throw an error if TitleId is empty", async () => {
        await expect(watchlistService.addOrRemoveTitle(userId, listId, ""))
            .rejects.toThrow("TitleId, UserId and ListId must be provided.");
    });

    test("should throw an error if Watchlist does not exist", async () => {
        watchlistDao.getWatchlistByListId.mockResolvedValue(null);
        await expect(watchlistService.addOrRemoveTitle(userId, listId, titleId))
            .rejects.toThrow("Watchlist doesn't exist!");
    });

    test("should throw an error if User does not exist", async () => {
        watchlistDao.getWatchlistByListId.mockResolvedValue({ listId, userId, titles: [] });
        userDao.getUserByUserId.mockResolvedValue(null);
        await expect(watchlistService.addOrRemoveTitle(userId, listId, titleId))
            .rejects.toThrow("User could not be found");
    });

    test("should throw an error if user is unauthorized", async () => {
        watchlistDao.getWatchlistByListId.mockResolvedValue({ listId, userId: "other-user", collaborators: [], titles: [] });
        userDao.getUserByUserId.mockResolvedValue({ userId });

        await expect(watchlistService.addOrRemoveTitle(userId, listId, titleId))
            .rejects.toThrow("User must be owner or collaborator on the watchlist to add a title");
    });

});

describe("createWatchlist", () => {

    // Test for missing userId or listName
    it("should throw an error if userId or listName is missing", async () => {
      await expect(watchlistService.createWatchlist()).rejects.toThrow("invalid data");
      await expect(watchlistService.createWatchlist(null, "My List")).rejects.toThrow("invalid data");
      await expect(watchlistService.createWatchlist(1, null)).rejects.toThrow("invalid data");
    });
  
    // Test for invalid listName length (less than 1 or more than 30 characters)
    it("should throw an error if listName length is invalid", async () => {
      await expect(watchlistService.createWatchlist(1, "")).rejects.toThrow("invalid data");
      await expect(watchlistService.createWatchlist(1, "A".repeat(31))).rejects.toThrow("listName must be between 1 and 30 characters long");
    });
  
    // Test for listName containing spaces
    it("should throw an error if listName contains spaces", async () => {
      await expect(watchlistService.createWatchlist(1, "My List")).rejects.toThrow("listName can not contain spaces!");
    });
  
    // Test for watchlist already existing
    it("should throw an error if a watchlist with that name already exists", async () => {
      watchlistDao.getWatchlistByUserIdAndListName.mockResolvedValue({}); // Simulating an existing watchlist
  
      await expect(watchlistService.createWatchlist(1, "MyWatchlist")).rejects.toThrow("watchlist with that name already exists!");
      expect(watchlistDao.getWatchlistByUserIdAndListName).toHaveBeenCalledWith(1, "MyWatchlist");
    });
  
    // Test for successful watchlist creation
    it("should create a new watchlist successfully", async () => {
      const mockWatchlist = {
        listId: "mockListId",
        userId: 1,
        listName: "MyWatchlist",
        collaborators: [],
        likes: [],
        titles: [],
        comments: [],
        isPublic: true
      };
  
      watchlistDao.getWatchlistByUserIdAndListName.mockResolvedValue(null); // No existing watchlist
      watchlistDao.createWatchlist.mockResolvedValue(mockWatchlist);
      uuid.v4.mockReturnValue("mockListId"); // Mock UUID
  
      const response = await watchlistService.createWatchlist(1, "MyWatchlist");
  
      expect(response).toEqual(mockWatchlist);
      expect(watchlistDao.createWatchlist).toHaveBeenCalledWith({
        listId: "mockListId",
        userId: 1,
        listName: "MyWatchlist",
        collaborators: [],
        likes: [],
        titles: [],
        comments: [],
        isPublic: true
      });
      expect(logger.info).toHaveBeenCalledWith("List successfully created: MyWatchlist");
    });
  
    // Test for error during watchlist creation
    it("should throw an error if there is an issue creating the watchlist", async () => {
      watchlistDao.getWatchlistByUserIdAndListName.mockResolvedValue(null); // No existing watchlist
      watchlistDao.createWatchlist.mockRejectedValue(new Error("Database error"));
  
      await expect(watchlistService.createWatchlist(1, "MyWatchlist")).rejects.toThrow("Database error");
      expect(logger.error).toHaveBeenCalledWith("Error in PostList: Database error");
    });
});


describe("getWatchlist", () => {

    // Test for missing user or listId
    it("should throw an error if listId or user is missing", async () => {
      await expect(watchlistService.getWatchlist()).rejects.toThrow("bad data");
      await expect(watchlistService.getWatchlist(null, "mockListId")).rejects.toThrow("bad data");
      await expect(watchlistService.getWatchlist({ userId: 1 }, null)).rejects.toThrow("bad data");
    });
  
    // Test for watchlist not found
    it("should throw an error if watchlist doesn't exist", async () => {
      watchlistDao.getWatchlistByListId.mockResolvedValue(null);
  
      await expect(watchlistService.getWatchlist({ userId: 1 }, "mockListId")).rejects.toThrow("Watchlist doesn't exist!");
      expect(watchlistDao.getWatchlistByListId).toHaveBeenCalledWith("mockListId");
    });
  
    // Test for public watchlist
    it("should return the watchlist if it is public", async () => {
      const mockWatchlist = {
        listId: "mockListId",
        userId: 1,
        isPublic: true,
        collaborators: [],
        titles: []
      };
  
      watchlistDao.getWatchlistByListId.mockResolvedValue(mockWatchlist);
  
      const response = await watchlistService.getWatchlist({ userId: 1 }, "mockListId");
      expect(response).toEqual(mockWatchlist);
    });
  
    // Test for private watchlist, user is the owner
    it("should return the watchlist if the user is the owner", async () => {
      const mockWatchlist = {
        listId: "mockListId",
        userId: 1,
        isPublic: false,
        collaborators: [],
        titles: []
      };
  
      watchlistDao.getWatchlistByListId.mockResolvedValue(mockWatchlist);
  
      const response = await watchlistService.getWatchlist({ userId: 1 }, "mockListId");
      expect(response).toEqual(mockWatchlist);
    });
  
    // Test for private watchlist, user is a collaborator
    it("should return the watchlist if the user is a collaborator", async () => {
      const mockWatchlist = {
        listId: "mockListId",
        userId: 1,
        isPublic: false,
        collaborators: [2], // User with userId 2 is a collaborator
        titles: []
      };
  
      watchlistDao.getWatchlistByListId.mockResolvedValue(mockWatchlist);
  
      const response = await watchlistService.getWatchlist({ userId: 2 }, "mockListId");
      expect(response).toEqual(mockWatchlist);
    });
  
    // Test for private watchlist, user is not a collaborator and is not the owner
    it("should return null if the user is not the owner or a collaborator", async () => {
      const mockWatchlist = {
        listId: "mockListId",
        userId: 1,
        isPublic: false,
        collaborators: [2], // Only userId 2 is a collaborator
        titles: []
      };
  
      watchlistDao.getWatchlistByListId.mockResolvedValue(mockWatchlist);
  
      const response = await watchlistService.getWatchlist({ userId: 3, isAdmin: false }, "mockListId");
      expect(response).toBeNull();
    });
  
    // Test for private watchlist, user is an admin
    it("should return the watchlist if the user is an admin", async () => {
      const mockWatchlist = {
        listId: "mockListId",
        userId: 1,
        isPublic: false,
        collaborators: [2],
        titles: []
      };
  
      watchlistDao.getWatchlistByListId.mockResolvedValue(mockWatchlist);
  
      const response = await watchlistService.getWatchlist({ userId: 3, isAdmin: true }, "mockListId");
      expect(response).toEqual(mockWatchlist);
    });
  
    // Test for error during execution
    it("should log and throw an error if there is an issue", async () => {
      watchlistDao.getWatchlistByListId.mockRejectedValue(new Error("Database error"));
  
      await expect(watchlistService.getWatchlist({ userId: 1 }, "mockListId")).rejects.toThrow("Database error");
      expect(logger.error).toHaveBeenCalledWith("Error in getWatchlist service: Error: Database error");
    });
  });


describe("removeCollaborator", () => {

    
    // Test for missing user, listId, or userId
    it("should throw an error if user, listId, or userId is missing", async () => {
      await expect(watchlistService.removeCollaborator()).rejects.toThrow("Bad Data");
      await expect(watchlistService.removeCollaborator(null, "mockListId", 1)).rejects.toThrow("Bad Data");
      await expect(watchlistService.removeCollaborator({ userId: 1 }, null, 1)).rejects.toThrow("Bad Data");
      await expect(watchlistService.removeCollaborator({ userId: 1 }, "mockListId", null)).rejects.toThrow("Bad Data");
    });
  
    // Test for user not found
    it("should throw an error if the user to remove is not found", async () => {
      userDao.getUserByUserId.mockResolvedValue(null); // Simulating user not found
  
      await expect(watchlistService.removeCollaborator({ userId: 1 }, "mockListId", 2)).rejects.toThrow("User not found");
      expect(userDao.getUserByUserId).toHaveBeenCalledWith(2);
    });
  
    // Test for watchlist not found
    it("should throw an error if the watchlist is not found", async () => {
      userDao.getUserByUserId.mockResolvedValue({ userId: 2 });
      watchlistDao.getWatchlistByListId.mockResolvedValue(null); // Simulating watchlist not found
  
      await expect(watchlistService.removeCollaborator({ userId: 1 }, "mockListId", 2)).rejects.toThrow("Watchlist not found");
      expect(watchlistDao.getWatchlistByListId).toHaveBeenCalledWith("mockListId");
    });
  
    // Test for user not being a collaborator of the watchlist
    it("should throw an error if the user is not a collaborator of the watchlist", async () => {
      const mockUser = { userId: 2 };
      const mockWatchlist = {
        listId: "mockListId",
        userId: 1,
        collaborators: [3], // User with ID 3 is a collaborator, not user 2
      };
  
      userDao.getUserByUserId.mockResolvedValue(mockUser);
      watchlistDao.getWatchlistByListId.mockResolvedValue(mockWatchlist);
  
      await expect(watchlistService.removeCollaborator({ userId: 1 }, "mockListId", 2)).rejects.toThrow("User is not a collaborator of this watchlist!");
      expect(watchlistDao.getWatchlistByListId).toHaveBeenCalledWith("mockListId");
    });
  
    // Test for removing a collaborator, where the user is not the owner and not themselves
    it("should throw an error if the user does not have permission to remove this user", async () => {
      const mockUser = { userId: 2, collaborativeLists: []}; // User to be removed
      const mockWatchlist = {
        listId: "mockListId",
        userId: 1, // Watchlist owner is user 1
        collaborators: [2], // Collaborator is user 2
      };
  
      userDao.getUserByUserId.mockResolvedValue(mockUser);
      watchlistDao.getWatchlistByListId.mockResolvedValue(mockWatchlist);
  
      // User 3 (not owner and not a collaborator) attempts to remove user 2
      await expect(watchlistService.removeCollaborator({ userId: 3 }, "mockListId", 2)).rejects.toThrow("You do not have permission to remove this User from the watchlist");
    });
  
    // Test for successful collaborator removal
    it("should successfully remove a collaborator", async () => {
      const mockUser = { userId: 2, collaborativeLists: ["mockListId"] }; // User to be removed
      const mockWatchlist = {
        listId: "mockListId",
        userId: 1, // Watchlist owner is user 1
        collaborators: [2], // Collaborator is user 2
      };
  
      userDao.getUserByUserId.mockResolvedValue(mockUser);
      watchlistDao.getWatchlistByListId.mockResolvedValue(mockWatchlist);
      userDao.updateUser.mockResolvedValue(true);
      watchlistDao.updateWatchlist.mockResolvedValue(true);
  
      const response = await watchlistService.removeCollaborator({ userId: 1 }, "mockListId", 2);
  
      expect(response).toBeUndefined(); // Assuming no return value on success
      expect(userDao.updateUser).toHaveBeenCalledWith(2, { collaborativeLists: [] });
      expect(watchlistDao.updateWatchlist).toHaveBeenCalledWith("mockListId", { collaborators: [] });
      expect(logger.info).toHaveBeenCalledWith("Watchlist mockListId and User successfully updated to remove collaborator: 2");
    });
  
    // Test for error during the process (e.g., database failure)
    it("should throw an error if there is an issue during the removal process", async () => {
      const mockUser = { userId: 2 };
      const mockWatchlist = {
        listId: "mockListId",
        userId: 1,
        collaborators: [2], // Collaborator is user 2
      };

      userDao.getUserByUserId.mockResolvedValue(mockUser);
      watchlistDao.getWatchlistByListId.mockResolvedValue(mockWatchlist);
  
      await expect(watchlistService.removeCollaborator({ userId: 1 }, "mockListId", 2)).rejects.toThrow("user is missing collaborativeLists");
     
    });
});


describe("getUserWatchlists", () => {

    // Test for missing userId (bad data)
    it("should throw an error if userId is missing", async () => {
      await expect(watchlistService.getUserWatchlists()).rejects.toThrow("bad data");
      await expect(watchlistService.getUserWatchlists(null)).rejects.toThrow("bad data");
    });
  
    // Test for no watchlists found for the user
    it("should throw an error if no watchlists are found for the user", async () => {
      watchlistDao.getWatchlistsByUserId.mockResolvedValue(null); // Simulate no lists found
  
      await expect(watchlistService.getUserWatchlists(1)).rejects.toThrow("No lists found");
      expect(watchlistDao.getWatchlistsByUserId).toHaveBeenCalledWith(1);
    });
  
    // Test for successfully retrieving watchlists
    it("should return watchlists if they are found", async () => {
      const mockWatchlists = [
        { listId: "list1", listName: "Watchlist 1", userId: 1 },
        { listId: "list2", listName: "Watchlist 2", userId: 1 }
      ];
  
      watchlistDao.getWatchlistsByUserId.mockResolvedValue(mockWatchlists); // Simulate retrieved watchlists
  
      const response = await watchlistService.getUserWatchlists(1);
      expect(response).toEqual(mockWatchlists);
      expect(watchlistDao.getWatchlistsByUserId).toHaveBeenCalledWith(1);
    });
  
    // Test for error during the database operation
    it("should log and throw an error if there is an issue during the retrieval", async () => {
      watchlistDao.getWatchlistsByUserId.mockRejectedValue(new Error("Database error"));
  
      await expect(watchlistService.getUserWatchlists(1)).rejects.toThrow("Database error");
      expect(logger.error).toHaveBeenCalledWith("Error in getUserWatchlists service: Error: Database error");
    });
});


describe("getCollaborativeLists", () => {

    // Test for missing userId (bad data)
    it("should throw an error if userId is missing", async () => {
      await expect(watchlistService.getCollaborativeLists()).rejects.toThrow("bad data");
      await expect(watchlistService.getCollaborativeLists(null)).rejects.toThrow("bad data");
    });
  
    // Test for user not found
    it("should throw an error if the user is not found", async () => {
      userDao.getUserByUserId.mockResolvedValue(null); // Simulate user not found
  
      await expect(watchlistService.getCollaborativeLists(1)).rejects.toThrow("User not found");
      expect(userDao.getUserByUserId).toHaveBeenCalledWith(1);
    });
  
    // Test for some collaborative lists not found
    it("should return only the existing collaborative lists and log errors for missing ones", async () => {
      const mockUser = {
        userId: 1,
        collaborativeLists: ["list1", "list2", "list3"]
      };
  
      const mockExistingList = {
        listId: "list1",
        listName: "Existing Watchlist",
        userId: 1
      };
  
      // Mock the userDao and watchlistDao
      userDao.getUserByUserId.mockResolvedValue(mockUser);
      watchlistDao.getWatchlistByListId.mockImplementation((listId) => {
        if (listId === "list1") {
          return mockExistingList; // Simulate list1 being found
        }
        return null; // Simulate list2 and list3 not found
      });
  
      // Call the function
      const response = await watchlistService.getCollaborativeLists(1);
  
      // Ensure only the existing list is returned
      expect(response).toEqual([mockExistingList]);
  
      // Ensure logger.error was called for the missing lists
      expect(logger.error).toHaveBeenCalledWith("list list2 not found");
      expect(logger.error).toHaveBeenCalledWith("list list3 not found");
  
      // Ensure the DAO functions were called correctly
      expect(userDao.getUserByUserId).toHaveBeenCalledWith(1);
      expect(watchlistDao.getWatchlistByListId).toHaveBeenCalledWith("list1");
      expect(watchlistDao.getWatchlistByListId).toHaveBeenCalledWith("list2");
      expect(watchlistDao.getWatchlistByListId).toHaveBeenCalledWith("list3");
    });
  
    // Test for successfully retrieving collaborative lists
    it("should return all collaborative lists if they are found", async () => {
      const mockUser = {
        userId: 1,
        collaborativeLists: ["list1", "list2"]
      };
  
      const mockList1 = {
        listId: "list1",
        listName: "Watchlist 1",
        userId: 1
      };
  
      const mockList2 = {
        listId: "list2",
        listName: "Watchlist 2",
        userId: 1
      };
  
      // Mock the userDao and watchlistDao
      userDao.getUserByUserId.mockResolvedValue(mockUser);
      watchlistDao.getWatchlistByListId.mockResolvedValueOnce(mockList1).mockResolvedValueOnce(mockList2);
  
      const response = await watchlistService.getCollaborativeLists(1);
  
      // Ensure all lists are returned correctly
      expect(response).toEqual([mockList1, mockList2]);
  
      // Ensure the DAO functions were called correctly
      expect(userDao.getUserByUserId).toHaveBeenCalledWith(1);
      expect(watchlistDao.getWatchlistByListId).toHaveBeenCalledWith("list1");
      expect(watchlistDao.getWatchlistByListId).toHaveBeenCalledWith("list2");
    });
  
    // Test for error during the database operation
    it("should log and throw an error if there is an issue during the retrieval", async () => {
      userDao.getUserByUserId.mockResolvedValue({ userId: 1, collaborativeLists: ["list1"] });
      watchlistDao.getWatchlistByListId.mockRejectedValue(new Error("Database error"));
  
      await expect(watchlistService.getCollaborativeLists(1)).rejects.toThrow("Database error");
      expect(logger.error).toHaveBeenCalledWith("Error in getCollaborativeLists service: Error: Database error");
    });
});

describe('Watchlist Service getAllWatchlists/ getPublicWatchlists', () => {
  const mockItems = [
      marshall({ id: "1", userId: 'user1', name: "Public List", isPublic: true, likes: ['like1', 'like2'] }),
      marshall({ id: "2", userId: 'user2', name: "Private List", isPublic: false, likes: ['like1'] }),
      marshall({ id: "3", userId: 'user3', name: "Public List1", isPublic: true, likes: ['like1','like2','like3'] }),
  ];

  beforeEach(() => {
      jest.clearAllMocks();
  });

  test('getAllWatchlists should return all items sorted', async () => {
    watchlistDao.getAllWatchlists.mockResolvedValue(mockItems);

    const result = await watchlistService.getAllWatchlists();
    
    expect(result).toEqual([
        { id: "3", userId: 'user3', name: "Public List1", isPublic: true, likes: ['like1','like2','like3'] },
        { id: "1", userId: 'user1', name: "Public List", isPublic: true, likes: ['like1', 'like2'] },
        { id: "2", userId: 'user2', name: "Private List", isPublic: false, likes: ['like1'] }
    ]);

    expect(result.every(w => 'username' in w)).toBe(true);
    
  });

  test('getPublicWatchlists should return public lists sorted', async () => {
    watchlistDao.getAllWatchlists.mockResolvedValue(mockItems);

    const result = await watchlistService.getPublicWatchlists();

    expect(result).toEqual([
      { id: "3", userId: 'user3', name: "Public List1", isPublic: true, likes: ['like1','like2','like3'] },
      { id: "1", userId: 'user1', name: "Public List", isPublic: true, likes: ['like1', 'like2'] }
    ]);

    expect(result.every(w => 'username' in w)).toBe(true);
    
  });
});