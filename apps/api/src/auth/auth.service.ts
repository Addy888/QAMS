import { Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { UsersService } from "../users/users.service";
import * as bcrypt from "bcrypt";

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService
  ) {}

  async validateUser(username: string, password: string) {
    console.log("ValidateUser: username =", username, "password =", password);
    const user = await this.usersService.findByUsername(username);
    console.log("User found in DB:", user);

    if (!user) {
      console.log("User not found in DB!");
      throw new UnauthorizedException("Invalid credentials");
    }

    const passwordMatch = await bcrypt.compare(
      password,
      user.passwordHash
    );
    console.log("Password match result:", passwordMatch);

    if (!passwordMatch) {
      throw new UnauthorizedException("Invalid credentials");
    }

    return user;
  }

  async login(username: string, password: string) {
    const user = await this.validateUser(username, password);

    const payload = {
      sub: user.id,
      username: user.username,
      role: user.role,
    };

    return {
      accessToken: this.jwtService.sign(payload),
      user,
    };
  }
}