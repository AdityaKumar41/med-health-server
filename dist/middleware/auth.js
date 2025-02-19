"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authMiddleware = void 0;
// import { verify } from 'jsonwebtoken'; // Assuming you are using JWT for token verification
// import { getWalletAddressFromDB } from '../services/userService'; // Import your database service
const authMiddleware = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    const authHeader = req.headers['authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        res.status(401).send("Unauthorized: Bearer token is missing or invalid");
        return;
    }
    const token = authHeader.split(' ')[1];
    try {
        // const decoded: any = verify(token, process.env.JWT_SECRET); // Verify the token
        // const walletAddress = decoded.walletAddress; // Assuming the token contains the wallet address
        if (!token) {
            res.status(401).send("Unauthorized: Wallet address is missing in token");
            return;
        }
        // const dbWalletAddress = await getWalletAddressFromDB(walletAddress); // Fetch wallet address from DB
        // if (!dbWalletAddress) {
        //     res.status(401).send("Unauthorized: Wallet address not found in database");
        //     return;
        // }
        next();
    }
    catch (error) {
        res.status(401).send("Unauthorized: Invalid token");
    }
});
exports.authMiddleware = authMiddleware;
