const watchlistService = require("../service/watchlistService");
const watchlistDao = require("../repository/watchlistDAO");
const uuid = require('uuid');

jest.mock("../repository/watchlistDAO");
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

    it("should not throw an error if the watchlist with the same name is the one being updated", async () => {
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