import { Router, Request, Response } from "express";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { SignedUrlSchema } from "../../types";
import {
  getSignedUrl,
  S3RequestPresigner,
} from "@aws-sdk/s3-request-presigner";

const awsRouter = Router();

const s3Client = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

awsRouter.post("/signedurl", async (req: Request, res: Response) => {
  const auth = req.headers.authorization?.split(" ")[1];
  if (!auth) {
    res.status(401).json({
      success: false,
      message: "Unauthorized",
    });
    return;
  }

  const body = req.body;
  const parsedBody = SignedUrlSchema.safeParse(body);

  if (!parsedBody.success) {
    res.status(400).send(parsedBody.error);
    return;
  }

  console.log(parsedBody.data);

  try {
    // create put object command
    const command = new PutObjectCommand({
      Bucket: process.env.S3_BUCKET_NAME!,
      Key: `upload/${auth}/${Date.now()}.${
        parsedBody.data.filetype.split("/")[1]
      }`,
    });

    console.log("command", command);

    const signedUrl = await getSignedUrl(s3Client, command, {
      expiresIn: 300, // 5 minutes
    });

    console.log("signedUrl", signedUrl);

    res.status(200).json({
      success: true,
      signedUrl,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

export default awsRouter;
