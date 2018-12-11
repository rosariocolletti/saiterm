pragma solidity ^0.4.23;

import "../node_modules/openzeppelin-solidity/contracts/crowdsale/validation/TimedCrowdsale.sol";
import '../node_modules/openzeppelin-solidity/contracts/token/ERC20/StandardBurnableToken.sol';
import '../node_modules/openzeppelin-solidity/contracts/ownership/Ownable.sol';
import '../node_modules/openzeppelin-solidity/contracts/ownership/CanReclaimToken.sol';

contract SaiexToken is StandardBurnableToken, Ownable {

  string public constant name = "Saiex Token";
  string public constant symbol = "SAIEX";
  uint8 public constant decimals = 18;

  constructor(uint _totalSupply, uint _crowdsaleSupply, uint _fundSupply, address _fundWallet) public {
    totalSupply_ = _totalSupply;

    // Allocate fixed supply to token Creator
    balances[msg.sender] = _crowdsaleSupply;
    emit Transfer(address(0), msg.sender, _crowdsaleSupply);

    // Allocate fixed supply to main Wallet
    balances[_fundWallet] = _fundSupply;
    emit Transfer(address(0), _fundWallet, _fundSupply);
  }
}


contract SaiexCrowdsale is TimedCrowdsale, CanReclaimToken {

  constructor(uint256 _openingTime, uint256 _closingTime, uint256 _rate, address _fundWallet, StandardBurnableToken _token, uint[] _timeBonus, uint[] _amountBonus) public
    Crowdsale(_rate, _fundWallet, _token)
    TimedCrowdsale(_openingTime, _closingTime)
  {
    // Setup time and amount bonus
    TimeBonusPricing(_timeBonus);
    AmountBonusPricing(_amountBonus);
  }

  // Override to extend the way in which ether is converted to tokens.
  function _getTokenAmount(uint256 _weiAmount)
    internal view returns (uint256)
  {
    uint256 currentRate = getCurrentRate(_weiAmount);
    return currentRate.mul(_weiAmount);
  }

  // Returns the rate of tokens per wei depending on time and amount
  function getCurrentRate(uint256 _weiAmount) public view returns (uint256) {
    uint256 currentRate;
    currentRate = rate;

    // Apply time bonus
    uint256 timeBonusRate;
    timeBonusRate = getCurrentTimeBonusRate();
    currentRate = currentRate.mul(timeBonusRate).div(100);

    // Apply amount bonus
    uint256 amountBonusRate;
    amountBonusRate = getCurrentAmountBonusRate(_weiAmount);
    currentRate = currentRate.mul(amountBonusRate).div(100);

    return currentRate;
  }


  struct Bonus {
    // Timestamp/Amount for bonus
    uint timeOrAmount;
    // Bonus rate multiplier, for example rate=120 means 20% Bonus
    uint rateMultiplier;
  }

  // Store bonuses in a fixed array, so that it can be seen in a blockchain explorer
  uint public constant MAX_BONUS = 10;
  Bonus[10] public timeBonus;
  Bonus[10] public amountBonus;

  // How many active time/amount Bonus we have
  uint public timeBonusCount;
  uint public amountBonusCount;

  // Get the current time bonus rateMultiplier
  function getCurrentTimeBonusRate() private constant returns (uint) {
    uint i;
    for(i=0; i<timeBonus.length; i++) {
      if(block.timestamp < timeBonus[i].timeOrAmount) {
        return timeBonus[i].rateMultiplier;
      }
    }
    return 100;
  }

  // Get the current amount bonus rateMultiplier
  // @param _weiAmount uint256 invested amount
  function getCurrentAmountBonusRate(uint256 _weiAmount) private constant returns (uint) {
    uint i;
    for(i=0; i<amountBonus.length; i++) {
      if(_weiAmount.mul(rate) >= amountBonus[i].timeOrAmount) {
        return amountBonus[i].rateMultiplier;
      }
    }
    return 100;
  }

  // @dev Construction, creating a list of time-based bonuses
  // @param _bonuses uint[] bonuses Pairs of (timeOrAmount, rateMultiplier)
  function TimeBonusPricing(uint[] _bonuses) internal {
    // Check array length, we need tuples
    require(!(_bonuses.length % 2 == 1 || _bonuses.length >= MAX_BONUS*2));
    timeBonusCount = _bonuses.length / 2;
    uint lastTimeOrAmount = 0;

    for(uint i=0; i<_bonuses.length/2; i++) {
      timeBonus[i].timeOrAmount  = _bonuses[i*2];
      timeBonus[i].rateMultiplier = _bonuses[i*2+1];

      // Next timestamp should be either 0 or later than previous one
      require(!((lastTimeOrAmount != 0) && (timeBonus[i].rateMultiplier != 100) && (timeBonus[i].timeOrAmount <= lastTimeOrAmount)));
      lastTimeOrAmount = timeBonus[i].timeOrAmount;
    }

    // Last rateMultiplier should be 100, indicating end of bonus
    require(timeBonus[timeBonusCount-1].rateMultiplier == 100);
  }

  // @dev Construction, creating a list of amount-based bonuses
  // @param _bonuses uint[] bonuses Pairs of (timeOrAmount, rateMultiplier)
  function AmountBonusPricing(uint[] _bonuses) internal {
    // Check array length, we need tuples
    require(!(_bonuses.length % 2 == 1 || _bonuses.length >= MAX_BONUS*2));
    amountBonusCount = _bonuses.length / 2;
    uint lastTimeOrAmount = 0;
    for(uint i=0; i<_bonuses.length/2; i++) {
      amountBonus[i].timeOrAmount  = _bonuses[i*2];
      amountBonus[i].rateMultiplier = _bonuses[i*2+1];

      // Next amount should be 0 or smaller
      require(!((lastTimeOrAmount != 0) && (amountBonus[i].timeOrAmount >= lastTimeOrAmount)));
      lastTimeOrAmount = amountBonus[i].timeOrAmount;
    }

    // Last rateMultiplier should be 100, indicating end of bonus
    require(amountBonus[amountBonusCount-1].rateMultiplier == 100);
  }

  // @dev allow Contract owner to change bonuses
  // @param _timeBonus uint[] bonuses Pairs of (timestamp, rateMultiplier)
  // @param _amountBonus uint[] bonuses Pairs of (wei amount, rateMultiplier)
  function changeBonuses(uint[] _timeBonus, uint[] _amountBonus) external {
    require(msg.sender == owner);
    TimeBonusPricing(_timeBonus);
    AmountBonusPricing(_amountBonus);
  }

  // @dev allow Contract owner to change start/stop time
  // @param _openingTime uint256  opening time
  // @param _closingTime uint256  closing time
  function changeOpeningClosingTime(uint256 _openingTime, uint256 _closingTime) external {
    require(msg.sender == owner);
    openingTime = _openingTime;
    closingTime = _closingTime;
  }

	// @dev allow Contract owner to change rate
  // @param _rate uint rate
  function changeRate(uint _rate) external {
    require(msg.sender == owner);
    rate = _rate;
  }
}
