import { Request, Response, NextFunction } from 'express';
// import { verify } from 'jsonwebtoken'; // Assuming you are using JWT for token verification
// import { getWalletAddressFromDB } from '../services/userService'; // Import your database service

export const authMiddleware = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
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
    } catch (error) {
        res.status(401).send("Unauthorized: Invalid token");
    }
}