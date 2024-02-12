// @ts-ignore
import jwt from "jsonwebtoken";

/**
 * Verify the JWT token payload and return decoded result
 * @param jwtToken
 * @returns
 */
export const verifyToken = (jwtToken: string) =>
  new Promise((resolve, reject) =>
    jwt.verify(
      jwtToken,
      process.env.JWT_SECRET_KEY,
      (error: unknown, decoded: unknown) => {
        if (error) {
          return reject(new Error("protected_endpoint"));
        }

        return resolve(decoded);
      }
    )
  );
